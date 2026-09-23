---
name: Vercel Hobby cron limit
description: Why RedotPay recovery uses event-driven verification with a daily scheduled fallback.
---

This Vercel project currently accepts cron expressions that run no more than once per day. Keep immediate RedotPay reconciliation on signed webhooks and customer return-page polling; use Vercel Cron only as a daily fallback unless the plan changes.

**Why:** Vercel rejected a five-minute production cron with `cron_jobs_limits_reached`, while accepting the daily schedule.

**How to apply:** Before increasing scheduled recovery frequency, verify the current Vercel plan supports it. Do not weaken cron authentication or replace authoritative provider reconciliation with client-only state.