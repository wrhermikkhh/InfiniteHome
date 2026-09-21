/**
 * Explicit operator action: configure a sandbox Git branch on Vercel.
 * --preview-wide instead isolates unused Preview settings without creating a branch.
 * Never deploys, edits production variables, or prints credential values.
 */
import { createPrivateKey } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { assertPreviewIsolation } from "../shared/preview-isolation";

const branch = "redotpay-sandbox";
const args = process.argv.slice(2);
const argument = (name: string) => args[args.indexOf(name) + 1];
const project = argument("--project");
const team = argument("--team");
const apply = args.includes("--apply");
const previewWide = args.includes("--preview-wide");
let stage = "validate-sandbox-credentials";

async function main() {
  if (!args.includes("--project") || !/^prj_[A-Za-z0-9]+$/.test(project || "") ||
      !args.includes("--team") || !/^team_[A-Za-z0-9]+$/.test(team || "")) {
    throw new Error("Explicit project and team IDs are required");
  }
  const database = process.env.SANDBOX_DATABASE_URL;
  const liveUrl = process.env.SUPABASE_URL;
  if (!database || !liveUrl) throw new Error("Sandbox and live-target comparison settings are required");
  const uri = new URL(database);
  const username = decodeURIComponent(uri.username);
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(uri.hostname);
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(uri.hostname);
  const reference = direct?.[1] || (pooler && username.startsWith("postgres.") ? username.slice(9) : "");
  const liveReference = new URL(liveUrl).hostname.split(".")[0];
  if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
      !/^[a-z0-9]{20}$/.test(reference) || reference === liveReference ||
      uri.pathname !== "/postgres" || !uri.password ||
      !["", "5432"].includes(uri.port) || uri.hash ||
      Array.from(uri.searchParams.keys()).some(key => !["sslmode", "sslrootcert"].includes(key))) {
    throw new Error("Sandbox database target did not pass isolation checks");
  }
  const appKey = process.env.REDOTPAY_SANDBOX_APP_KEY;
  const encoded = (process.env.REDOTPAY_SANDBOX_PRIVATE_KEY_BASE64 || "").replace(/\s/g, "");
  if (!appKey || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("Validated sandbox provider credentials are required");
  }
  const keyBytes = Buffer.from(encoded, "base64");
  if (keyBytes.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new Error("Sandbox key encoding is invalid");
  }
  const privateKey = keyBytes.toString("utf8");
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
    throw new Error("Sandbox signing key is invalid");
  }

  const connectors = new ReplitConnectors();
  const query = `teamId=${team}`;
  async function request(path: string, init: RequestInit = {}) {
    const response = await connectors.proxy("vercel", path, init);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const code = body?.error?.code;
      const message = String(body?.error?.message || "").toLowerCase();
      console.error(JSON.stringify({
        stage, httpStatus: response.status,
        providerCode: typeof code === "string" && /^[a-z_]{1,60}$/i.test(code) ? code : "unreported",
        branchMissing: /branch/.test(message) && /not found|does not exist|exist/.test(message),
        invalidValue: /empty|value/.test(message),
      }));
      throw new Error("Vercel configuration request failed");
    }
    return response.json();
  }
  stage = "verify-project-and-existing-scopes";
  const details = await request(`/v9/projects/${project}?${query}`);
  if (details.id !== project || !details.link || details.link.productionBranch === branch) {
    throw new Error("Expected Git-connected project with a separate production branch");
  }
  const before = await request(`/v10/projects/${project}/env?decrypt=false&${query}`);
  // Do not use decrypted values. A changed ID/timestamp/target would expose
  // an accidental mutation of another environment without logging secrets.
  const unrelated = (envs: any[]) => JSON.stringify(envs
    .filter(e => previewWide ? e.target.some((t: string) => t !== "preview") : e.gitBranch !== branch)
    .map(e => ({
      id: e.id, key: e.key, type: e.type,
      updatedAt: previewWide ? undefined : e.updatedAt,
      target: previewWide ? e.target.filter((t: string) => t !== "preview") : e.target,
      gitBranch: e.gitBranch,
      // Compared only in memory. Never log provider values, even encrypted ones.
      value: e.value,
    }))
    .sort((a, b) => a.id.localeCompare(b.id)));
  const unrelatedBefore = unrelated(before.envs);
  const values: Record<string, string> = {
    DATABASE_URL: database,
    PREVIEW_DATABASE_PROJECT_REF: reference,
    REDOTPAY_ENVIRONMENT: "sandbox",
    REDOTPAY_ENABLED: "false",
    REDOTPAY_LIVE_APPROVED: "false",
    REDOTPAY_MVR_PER_USD: "15.42",
    REDOTPAY_KEY_VERSION: "1",
    REDOTPAY_APP_KEY: appKey,
    REDOTPAY_PRIVATE_KEY: privateKey,
    // Override inherited credentials, rather than simply omitting them.
    RESEND_API_KEY: "",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_SERVICE_KEY: "",
    CRON_SECRET: "",
    // Origins cannot be guessed before the user publishes the preview.
    ADMIN_PUBLIC_ORIGIN: "",
    REDOTPAY_PUBLIC_ORIGIN: "",
    REDOTPAY_ACCEPTANCE_ENABLED: "",
    REDOTPAY_ACCEPTANCE_APP_KEY: "",
    REDOTPAY_ACCEPTANCE_WEBHOOK_PUBLIC_KEY: "",
  };
  const variables = Object.entries(values).map(([key, value]) => ({
    key, value, type: "encrypted", target: ["preview"],
    ...(previewWide ? {} : { gitBranch: branch }),
  }));
  assertPreviewIsolation({ ...values, VERCEL_ENV: "preview" });
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run", branch: previewWide ? null : branch, target: "preview",
    keys: Object.keys(values), checkoutEnabled: false, publishesDeployment: false,
    deploymentProtectionEnabled: !!details.ssoProtection || !!details.passwordProtection,
  }));
  if (previewWide) {
    stage = "verify-preview-environment-unused";
    const deployments = await request(`/v7/deployments?projectId=${project}&limit=100&${query}`);
    if (deployments.pagination?.next || deployments.deployments?.some((d: any) => d.target !== "production") ||
        before.envs.some((e: any) => e.gitBranch && e.target.includes("preview"))) {
      throw new Error("Preview-wide setup requires no existing preview deployments or branch overrides");
    }
  }
  if (!apply) return;
  if (previewWide) {
    stage = "remove-preview-inheritance-preserving-other-scopes";
    for (const env of before.envs) {
      if (!env.gitBranch && Object.hasOwn(values, env.key) && env.target.includes("preview") &&
          env.target.some((t: string) => t !== "preview")) {
        await request(`/v9/projects/${project}/env/${env.id}?${query}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // Scope-only update: no credential value is fetched or replaced.
          body: JSON.stringify({ target: env.target.filter((t: string) => t !== "preview") }),
        });
      }
    }
  }
  stage = "save-preview-only-settings";
  const result = await request(`/v10/projects/${project}/env?upsert=true&${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(variables),
  });
  if (result.failed?.length) {
    console.error(JSON.stringify({
      stage, rejectedKeys: result.failed.map((item: any) => {
        const key = item.error?.key || item.error?.envVarKey;
        return typeof key === "string" && Object.hasOwn(values, key) ? key : "unreported";
      }),
    }));
    throw new Error("Some preview settings failed; inspect key metadata before proceeding");
  }
  stage = "verify-saved-scopes";
  const after = await request(`/v10/projects/${project}/env?decrypt=false&${query}`);
  if (unrelated(after.envs) !== unrelatedBefore) {
    throw new Error("Unrelated environment metadata changed; stop and review");
  }
  for (const key of Object.keys(values)) {
    const matches = after.envs.filter((e: any) =>
      e.key === key && (previewWide ? !e.gitBranch : e.gitBranch === branch) && e.target.includes("preview"));
    if (matches.length !== 1 || matches[0].target.length !== 1 || matches[0].target[0] !== "preview") {
      throw new Error("Preview setting scope verification failed");
    }
  }
  console.log(JSON.stringify({
    previewConfigurationSaved: true, branch: previewWide ? null : branch, configuredKeys: variables.length,
    otherEnvironmentMetadataUnchanged: true, deploymentCreated: false,
  }));
}

main().catch(() => {
  // Provider/network/URL errors can contain submitted secrets. Never log them.
  console.error(JSON.stringify({ previewConfigurationComplete: false, stage, deploymentRequested: false }));
  process.exitCode = 1;
});