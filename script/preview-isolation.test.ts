import assert from "node:assert/strict";
import test from "node:test";
import { assertPreviewIsolation } from "../shared/preview-isolation.ts";

const ref = "abcdefghijklmnopqrst";
const valid = {
  VERCEL_ENV: "preview",
  REDOTPAY_ENVIRONMENT: "sandbox",
  REDOTPAY_ENABLED: "false",
  REDOTPAY_LIVE_APPROVED: "false",
  PREVIEW_DATABASE_PROJECT_REF: ref,
  DATABASE_URL: `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres`,
  RESEND_API_KEY: "",
  CRON_SECRET: "",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
};

function rejects(env: Record<string, string | undefined>, pattern?: RegExp) {
  assert.throws(() => assertPreviewIsolation(env), pattern);
}

test("production and development are unchanged no-ops", () => {
  assert.doesNotThrow(() => assertPreviewIsolation({ VERCEL_ENV: "production" }));
  assert.doesNotThrow(() => assertPreviewIsolation({ VERCEL_ENV: "development" }));
  assert.doesNotThrow(() => assertPreviewIsolation({}));
});

test("accepts a disabled isolated preview and canonical pooler URLs", () => {
  assert.doesNotThrow(() => assertPreviewIsolation(valid));
  assert.doesNotThrow(() => assertPreviewIsolation({
    ...valid,
    DATABASE_URL: `postgres://postgres.${ref}:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  }));
});

test("rejects missing, malformed, and mismatched preview databases", () => {
  rejects({ ...valid, DATABASE_URL: undefined }, /DATABASE_URL is required/);
  rejects({ ...valid, PREVIEW_DATABASE_PROJECT_REF: "short" }, /valid Supabase project ref/);
  rejects({ ...valid, DATABASE_URL: "mysql://localhost/postgres" }, /canonical Supabase/);
  rejects({
    ...valid,
    DATABASE_URL: `postgresql://postgres:password@db.11111111111111111111.supabase.co:5432/postgres`,
  }, /does not match/);
});

test("rejects connection identity query injection", () => {
  for (const query of [
    "host=live.example.com",
    "user=postgres.live",
    "username=postgres.live",
    "database=live",
    "dbname=live",
    "port=9999",
  ]) {
    rejects({ ...valid, DATABASE_URL: `${valid.DATABASE_URL}?${query}` }, /may not override/);
  }
});

test("rejects live payment configuration", () => {
  rejects({ ...valid, REDOTPAY_ENVIRONMENT: "production" }, /must be sandbox/);
  rejects({ ...valid, REDOTPAY_LIVE_APPROVED: "true" }, /must not be true/);
});

test("rejects inherited email, cron, and storage configuration", () => {
  for (const name of [
    "RESEND_API_KEY",
    "CRON_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
  ]) {
    rejects({ ...valid, [name]: "inherited-live-value" }, new RegExp(`${name} must be empty`));
  }
});

test("enabled payment or fixtures require matching explicit preview origins", () => {
  rejects({ ...valid, REDOTPAY_ENABLED: "true" }, /explicit ADMIN_PUBLIC_ORIGIN/);
  const origins = {
    ADMIN_PUBLIC_ORIGIN: "https://redotpay-sandbox-git-branch-team.vercel.app",
    REDOTPAY_PUBLIC_ORIGIN: "https://redotpay-sandbox-git-branch-team.vercel.app",
  };
  assert.doesNotThrow(() => assertPreviewIsolation({ ...valid, REDOTPAY_ENABLED: "true", ...origins }));
  assert.doesNotThrow(() => assertPreviewIsolation({
    ...valid,
    REDOTPAY_ACCEPTANCE_ENABLED: "I_ACCEPT_NON_PRODUCTION_WEBHOOK_TESTS",
    ...origins,
  }));
  rejects({
    ...valid,
    REDOTPAY_ENABLED: "true",
    ...origins,
    REDOTPAY_PUBLIC_ORIGIN: "https://another-preview.vercel.app",
  }, /exactly match/);
});

test("rejects inferred, malformed, and known live origins", () => {
  const enabled = { ...valid, REDOTPAY_ENABLED: "true" };
  rejects({
    ...enabled,
    ADMIN_PUBLIC_ORIGIN: "https://infinite-home.vercel.app",
    REDOTPAY_PUBLIC_ORIGIN: "https://infinite-home.vercel.app",
  }, /non-live/);
  rejects({
    ...enabled,
    ADMIN_PUBLIC_ORIGIN: "https://preview.vercel.app/",
    REDOTPAY_PUBLIC_ORIGIN: "https://preview.vercel.app/",
  }, /bare HTTPS/);
  rejects({
    ...enabled,
    ADMIN_PUBLIC_ORIGIN: "http://preview.vercel.app",
    REDOTPAY_PUBLIC_ORIGIN: "http://preview.vercel.app",
  }, /non-live/);
  rejects({
    ...enabled,
    ADMIN_PUBLIC_ORIGIN: "https://preview.vercel.app:444",
    REDOTPAY_PUBLIC_ORIGIN: "https://preview.vercel.app:444",
  }, /non-live/);
  rejects({ ...enabled, VERCEL_URL: "preview.vercel.app" }, /explicit/);
});

test("errors never echo supplied secrets", () => {
  const secret = "never-echo-this-sensitive-value";
  try {
    assertPreviewIsolation({ ...valid, RESEND_API_KEY: secret });
    assert.fail("expected isolation rejection");
  } catch (error) {
    assert.equal(String(error).includes(secret), false);
  }
});