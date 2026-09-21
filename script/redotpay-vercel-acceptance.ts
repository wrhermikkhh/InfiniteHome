/**
 * Opt-in acceptance probe for the raw bytes delivered to the RedotPay webhook
 * by an already-deployed, non-production Vercel preview.
 *
 * This script never calls RedotPay. It deliberately uses an unknown merchant
 * order ID, so a correctly verified request stops at the local database lookup
 * and cannot trigger detail, close, payment, stock, or order mutations.
 */
import { createHash, createPrivateKey, sign } from "node:crypto";

const CONSENT = "I_ACCEPT_NON_PRODUCTION_WEBHOOK_TESTS";
const env = process.env;

function fail(message: string): never {
  throw new Error(message);
}

function required(name: string): string {
  const value = env[name];
  if (!value) fail(`${name} is required`);
  return value;
}

if (env.REDOTPAY_ACCEPTANCE_ENABLED !== CONSENT) {
  fail(`Refusing to send: REDOTPAY_ACCEPTANCE_ENABLED must equal ${CONSENT}`);
}
if (env.REDOTPAY_ACCEPTANCE_DEPLOYMENT_KIND !== "vercel-preview") {
  fail("Refusing to send: target must be explicitly identified as vercel-preview");
}
if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
  fail("Refusing to send from a production runtime");
}

const origin = new URL(required("REDOTPAY_ACCEPTANCE_ORIGIN"));
if (origin.protocol !== "https:" || origin.username || origin.password || origin.port ||
    origin.pathname !== "/" || origin.search || origin.hash ||
    !origin.hostname.endsWith(".vercel.app")) {
  fail("REDOTPAY_ACCEPTANCE_ORIGIN must be a bare HTTPS *.vercel.app preview origin");
}
if (required("REDOTPAY_ACCEPTANCE_CONFIRMED_ORIGIN") !== origin.origin) {
  fail("Confirmed origin must exactly match REDOTPAY_ACCEPTANCE_ORIGIN");
}
if (env.REDOTPAY_PUBLIC_ORIGIN === origin.origin) {
  fail("Refusing a target configured as REDOTPAY_PUBLIC_ORIGIN");
}

const appKey = required("REDOTPAY_ACCEPTANCE_APP_KEY");
const timestamp = env.REDOTPAY_ACCEPTANCE_TIMESTAMP || String(Date.now());
if (!/^\d{13}$/.test(timestamp)) fail("REDOTPAY_ACCEPTANCE_TIMESTAMP must be 13 decimal digits");

// Keep this byte sequence stable: spaces, indentation and final newline are part
// of the signature. The ID must remain absent from the acceptance database.
const rawBody = Buffer.from(
  '{\n' +
  '  "actionType": "ACQUIRER_PAY",\n' +
  '  "outerOrderSn": "RP_ACCEPTANCE_RAW_BODY_DOES_NOT_EXIST",\n' +
  '  "orderStatus": 2,\n' +
  '  "note": "whitespace-sensitive fixture"\n' +
  '}\n',
  "utf8",
);

let signature = env.REDOTPAY_ACCEPTANCE_SIGNATURE;
if (!signature) {
  const pem = required("REDOTPAY_ACCEPTANCE_WEBHOOK_PRIVATE_KEY").replace(/\\n/g, "\n");
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "rsa" ||
      (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
    fail("Acceptance webhook signing key must be RSA 2048-bit or stronger");
  }
  signature = sign(
    "RSA-SHA256",
    Buffer.concat([Buffer.from(`${appKey}.${timestamp}.`), rawBody]),
    key,
  ).toString("base64");
}
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
  fail("REDOTPAY_ACCEPTANCE_SIGNATURE is not base64");
}

const endpoint = new URL("/api/payments/redotpay/webhook", origin);
const headers = {
  "content-type": "application/json",
  "x-r-ts": timestamp,
  "x-r-key-version": "1",
  "x-r-signature": signature,
  ...(env.VERCEL_ACCEPTANCE_BYPASS_SECRET
    ? { "x-vercel-protection-bypass": env.VERCEL_ACCEPTANCE_BYPASS_SECRET }
    : {}),
};

type Observation = { name: string; status: number; result: string };

async function post(name: string, body: Buffer): Promise<Observation> {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers,
    body,
  });
  const text = await response.text();
  let message = "";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string") message = parsed.message;
  } catch {
    // Never echo an unexpected remote response.
  }
  return {
    name,
    status: response.status,
    result: message === "No payment found" ? "verified-unknown-order"
      : message === "Invalid payment signature" ? "signature-rejected"
      : "unexpected-response",
  };
}

const observations: Observation[] = [];
observations.push(await post("exact", rawBody));
observations.push(await post("exact-retry", rawBody));

// Same JSON value after parse/stringify, different bytes and therefore invalid.
const whitespaceTamper = Buffer.from(JSON.stringify(JSON.parse(rawBody.toString("utf8"))));
observations.push(await post("whitespace-tamper", whitespaceTamper));

// One semantic byte change with the original signature must also be rejected.
const semanticTamper = Buffer.from(rawBody.toString("utf8").replace('"orderStatus": 2', '"orderStatus": 4'));
observations.push(await post("semantic-tamper", semanticTamper));

const expected = [
  ["exact", 404, "verified-unknown-order"],
  ["exact-retry", 404, "verified-unknown-order"],
  ["whitespace-tamper", 401, "signature-rejected"],
  ["semantic-tamper", 401, "signature-rejected"],
];
for (let i = 0; i < expected.length; i++) {
  const [name, status, result] = expected[i];
  const actual = observations[i];
  if (actual.name !== name || actual.status !== status || actual.result !== result) {
    fail(`Acceptance failed at ${name}: HTTP ${actual.status}, ${actual.result}`);
  }
}

console.log(JSON.stringify({
  accepted: true,
  scope: "actual-vercel-raw-body-only",
  targetHost: origin.hostname,
  fixtureSha256: createHash("sha256").update(rawBody).digest("hex"),
  timestamp,
  observations,
}, null, 2));