type Environment = Record<string, string | undefined>;

const PROJECT_REF = /^[a-z0-9]{20}$/;
const LIVE_ORIGINS = new Set([
  "https://infinite-home.vercel.app",
  "https://infinitehome.mv",
  "https://www.infinitehome.mv",
]);

function fail(message: string): never {
  throw new Error(`Unsafe Vercel Preview configuration: ${message}`);
}

function nonempty(env: Environment, name: string): boolean {
  return typeof env[name] === "string" && env[name]!.length > 0;
}

function databaseProjectRef(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("DATABASE_URL must be a canonical Supabase connection URI");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash ||
      url.pathname !== "/postgres" || !url.port || !url.password) {
    return fail("DATABASE_URL must be a canonical Supabase connection URI");
  }
  for (const key of Array.from(url.searchParams.keys())) {
    if (!["sslmode", "sslrootcert"].includes(key)) {
      return fail("DATABASE_URL may not override connection identity in query parameters");
    }
  }

  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
  if (direct && url.port === "5432" && url.username === "postgres") return direct[1];

  const pooler = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/.test(url.hostname);
  const user = /^postgres\.([a-z0-9]{20})$/.exec(url.username);
  if (pooler && user && ["5432", "6543"].includes(url.port)) return user[1];

  return fail("DATABASE_URL must identify one canonical Supabase project");
}

function previewOrigin(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`${name} must be a bare HTTPS Vercel Preview origin`);
  }
  if (url.protocol !== "https:" || url.port || url.origin !== value ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/.test(url.hostname) ||
      LIVE_ORIGINS.has(url.origin)) {
    return fail(`${name} must be a non-live bare HTTPS Vercel Preview origin`);
  }
  return url;
}

export function assertPreviewIsolation(env: Environment): void {
  if (env.VERCEL_ENV !== "preview") return;

  if (env.REDOTPAY_ENVIRONMENT !== "sandbox") {
    fail("REDOTPAY_ENVIRONMENT must be sandbox");
  }
  if (env.REDOTPAY_LIVE_APPROVED === "true") {
    fail("REDOTPAY_LIVE_APPROVED must not be true");
  }

  const expectedRef = env.PREVIEW_DATABASE_PROJECT_REF;
  if (!expectedRef || !PROJECT_REF.test(expectedRef)) {
    fail("PREVIEW_DATABASE_PROJECT_REF must be a valid Supabase project ref");
  }
  if (!env.DATABASE_URL) fail("DATABASE_URL is required");
  if (databaseProjectRef(env.DATABASE_URL) !== expectedRef) {
    fail("DATABASE_URL project does not match PREVIEW_DATABASE_PROJECT_REF");
  }

  for (const name of [
    "RESEND_API_KEY",
    "CRON_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
  ]) {
    if (nonempty(env, name)) fail(`${name} must be empty`);
  }

  if (env.REDOTPAY_ENABLED === "true" || nonempty(env, "REDOTPAY_ACCEPTANCE_ENABLED")) {
    if (!env.ADMIN_PUBLIC_ORIGIN || !env.REDOTPAY_PUBLIC_ORIGIN) {
      fail("explicit ADMIN_PUBLIC_ORIGIN and REDOTPAY_PUBLIC_ORIGIN are required");
    }
    const admin = previewOrigin(env.ADMIN_PUBLIC_ORIGIN, "ADMIN_PUBLIC_ORIGIN");
    const redotpay = previewOrigin(env.REDOTPAY_PUBLIC_ORIGIN, "REDOTPAY_PUBLIC_ORIGIN");
    if (admin.origin !== redotpay.origin) fail("preview public origins must exactly match");
  }
}