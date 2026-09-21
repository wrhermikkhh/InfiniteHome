/**
 * Historical evidence-only ledger backfill. Defaults to a read-only dry run.
 * Never computes allocations from current stock, never changes product stock,
 * never reads DATABASE_URL and never runs a migration.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const args = process.argv.slice(2);
const option = (key: string) => {
  const index = args.indexOf(key);
  return index < 0 ? undefined : args[index + 1];
};
const canonical = (value: any): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
};
const digest = (value: any) => createHash("sha256").update(canonical(value)).digest("hex");
const requiredText = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a nonempty reviewed string`);
};
const usage = `Historical ledger reconciliation (no stock changes):
  --inspect order:ID | pos:ID         read-only inventory snapshot and fingerprint
  --plan reviewed-plan.json          read-only validation (default)
  --plan reviewed-plan.json --apply --approve-sha256 HASH --confirm-database NAME
  --validate-plan reviewed-plan.json structural validation only; no DB connection
Supply only INVENTORY_RECONCILIATION_URL through the operator's secret manager.
Never uses DATABASE_URL; no secrets/connection strings are printed.
See script/LEGACY_INVENTORY_OPERATIONS.md for the plan format and review procedure.`;

function validatePlan(plan: any) {
  if (plan.version !== 1) throw new Error("Plan version must be 1");
  requiredText(plan.reviewedBy, "reviewedBy");
  requiredText(plan.reviewedAt, "reviewedAt");
  if (!Number.isFinite(Date.parse(plan.reviewedAt))) throw new Error("reviewedAt must be a timestamp");
  requiredText(plan.target?.hostname, "target.hostname");
  requiredText(plan.target?.database, "target.database");
  if (!Array.isArray(plan.entries) || !plan.entries.length) throw new Error("Plan requires entries");
  const owners = new Set();
  for (const entry of plan.entries) {
    if (!["order", "pos"].includes(entry.ownerType)) throw new Error("ownerType must be order or pos");
    requiredText(entry.ownerId, "ownerId");
    if (owners.has(`${entry.ownerType}:${entry.ownerId}`)) throw new Error("Duplicate plan owner");
    owners.add(`${entry.ownerType}:${entry.ownerId}`);
    if (!/^[a-f0-9]{64}$/.test(entry.snapshotSha256)) throw new Error("A fresh --inspect snapshotSha256 is required");
    requiredText(entry.evidenceReference, "evidenceReference");
    requiredText(entry.explanation, "explanation");
    if (!["outstanding", "already_restored"].includes(entry.disposition)) throw new Error("Unknown disposition");
    if (entry.disposition === "already_restored" && (!entry.restoredAt || !Number.isFinite(Date.parse(entry.restoredAt)))) throw new Error("already_restored requires an evidenced restoredAt timestamp");
    if (entry.disposition === "outstanding" && entry.restoredAt != null) throw new Error("Outstanding allocation cannot have restoredAt");
    if (!Array.isArray(entry.allocations)) throw new Error("Explicit allocations array required, including [] when evidence proves no deduction");
    for (const allocation of entry.allocations) {
      if (Object.keys(allocation).sort().join(",") !== "capped,key,preorder,productId,qty") throw new Error("Allocation must contain exactly productId,qty,key,preorder,capped");
      requiredText(allocation.productId, "allocation.productId");
      if (!Number.isSafeInteger(allocation.qty) || allocation.qty <= 0) throw new Error("Allocation qty must be a positive integer");
      if (allocation.key !== null) requiredText(allocation.key, "allocation.key");
      if (typeof allocation.preorder !== "boolean" || typeof allocation.capped !== "boolean") throw new Error("Allocation flags must be booleans");
      if (!allocation.preorder && allocation.capped !== (allocation.key === null)) throw new Error("Regular allocation must identify either exact variant or general stock");
    }
  }
}

async function main() {
  if (args.includes("--help") || !args.length) { console.log(usage); return; }
  const validateFile = option("--validate-plan");
  const file = validateFile || option("--plan");
  const plan = file ? JSON.parse(readFileSync(file, "utf8")) : null;
  if (plan) validatePlan(plan);
  if (validateFile) { console.log(JSON.stringify({ valid: true, planSha256: digest(plan) })); return; }
  const inspect = option("--inspect");
  if ((!plan && !inspect) || (plan && inspect)) throw new Error("Choose exactly --inspect or --plan");
  const apply = args.includes("--apply");
  if (apply && !plan) throw new Error("--apply requires a reviewed plan");
  const planSha256 = plan ? digest(plan) : undefined;
  if (apply && option("--approve-sha256") !== planSha256) throw new Error("Explicit approval hash must match the complete reviewed plan");
  const connection = process.env.INVENTORY_RECONCILIATION_URL;
  if (!connection) throw new Error("Operator must explicitly supply INVENTORY_RECONCILIATION_URL; no application DB fallback");
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL connection required");
  if (!url.hostname || !url.username || url.pathname.length < 2) throw new Error("Explicit connection host, user and database are required");
  if (["host", "hostaddr", "port", "user", "database", "dbname", "service", "options"].some(key => url.searchParams.has(key))) throw new Error("Connection URL cannot override the reviewed target or settings through query parameters");
  const database = decodeURIComponent(url.pathname.slice(1));
  if (plan && (plan.target.hostname !== url.hostname || plan.target.database !== database)) throw new Error("Connection target does not match reviewed plan");
  if (apply && option("--confirm-database") !== database) throw new Error("Explicit --confirm-database must match the reviewed target");
  const client = new pg.Client({ connectionString: connection, application_name: "inventory_historical_reconciliation", statement_timeout: 15000, lock_timeout: 5000 });
  await client.connect();
  let began = false;
  try {
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    began = true;
    // Limit table resolution to the reviewed application's public schema.
    await client.query("SET LOCAL search_path TO public, pg_catalog");
    const actual = await client.query("SELECT current_database() AS name");
    if (actual.rows[0].name !== database) throw new Error("Database identity mismatch");
    const load = async (ownerType: string, ownerId: string) => {
      if (!["order", "pos"].includes(ownerType)) throw new Error("Invalid owner type");
      // Only internal allowlisted SQL identifiers; values always parameterized.
      const table = ownerType === "order" ? "orders" : "pos_transactions";
      const conversion = ownerType === "pos" ? ", converted_to_order_id" : "";
      const result = await client.query(`SELECT id,status,payment_method,items${conversion} FROM ${table} WHERE id=$1${apply ? " FOR UPDATE" : ""}`, [ownerId]);
      if (!result.rows[0]) throw new Error(`Owner not found: ${ownerType}:${ownerId}`);
      const row = result.rows[0];
      if (row.payment_method === "redotpay") throw new Error("RedotPay allocations must be reconciled through provider recovery, never this script");
      const snapshot = {
        ownerType, ownerId, status: row.status, paymentMethod: row.payment_method,
        convertedToOrderId: row.converted_to_order_id || null,
        items: row.items.map((i: any) => ({ productId: i.productId || null, qty: i.qty, size: i.size || null, color: i.color || null, isPreOrder: !!i.isPreOrder })),
      };
      return { snapshot, snapshotSha256: digest(snapshot) };
    };
    if (inspect) {
      const [ownerType, ...id] = inspect.split(":");
      const result = await load(ownerType, id.join(":"));
      console.log(JSON.stringify(result, null, 2));
      await client.query("ROLLBACK"); began = false; return;
    }
    const report: any[] = [];
    // Deterministic owner lock order; product rows are checked, not mutated.
    for (const entry of [...plan.entries].sort((a, b) => `${a.ownerType}:${a.ownerId}`.localeCompare(`${b.ownerType}:${b.ownerId}`))) {
      const { snapshot, snapshotSha256 } = await load(entry.ownerType, entry.ownerId);
      if (snapshotSha256 !== entry.snapshotSha256) throw new Error("Owner changed since review; inspect and review a new plan");
      if (snapshot.convertedToOrderId) throw new Error("Already converted POS: reconcile its order instead; never backfill both owners");
      const cancelled = ["cancelled", "refunded"].includes(snapshot.status);
      if (cancelled !== (entry.disposition === "already_restored")) throw new Error("Disposition conflicts with owner status; investigate instead of changing stock automatically");
      const existing = await client.query("SELECT allocations,restored_at FROM legacy_inventory_reservations WHERE owner_type=$1 AND owner_id=$2", [entry.ownerType, entry.ownerId]);
      if (existing.rowCount) throw new Error("Owner already has an inventory ledger; existing evidence will never be overwritten");
      const ordered = new Map<string, number>();
      for (const item of snapshot.items) if (item.productId) {
        if (!Number.isSafeInteger(item.qty) || item.qty <= 0) throw new Error("Historical item quantity is invalid; manual investigation required");
        ordered.set(item.productId, (ordered.get(item.productId) || 0) + item.qty);
      }
      const totals = new Map<string, number>();
      for (const allocation of entry.allocations) {
        totals.set(allocation.productId, (totals.get(allocation.productId) || 0) + allocation.qty);
        if (!ordered.has(allocation.productId) || totals.get(allocation.productId)! > ordered.get(allocation.productId)!) throw new Error("Allocations exceed evidence in owner items; manual investigation required");
        const result = await client.query("SELECT stock,variant_stock,pre_order_stock,pre_order_variant_stock FROM products WHERE id=$1", [allocation.productId]);
        const product = result.rows[0];
        if (!product) throw new Error("Allocation product missing; manual investigation required");
        if (entry.disposition === "outstanding") {
          const map = product[allocation.preorder ? "pre_order_variant_stock" : "variant_stock"] || {};
          if (allocation.key !== null && !Number.isSafeInteger(map[allocation.key])) throw new Error("Recorded variant cannot currently be restored; resolve catalog configuration separately");
          if (allocation.capped && !Number.isSafeInteger(product[allocation.preorder ? "pre_order_stock" : "stock"])) throw new Error("Recorded cap cannot currently be restored; resolve catalog configuration separately");
        }
      }
      if (apply) {
        await client.query("INSERT INTO legacy_inventory_reservations(owner_type,owner_id,allocations,restored_at) VALUES($1,$2,$3::jsonb,$4)", [entry.ownerType, entry.ownerId, JSON.stringify(entry.allocations), entry.disposition === "already_restored" ? entry.restoredAt : null]);
      }
      report.push({ ownerType: entry.ownerType, ownerId: entry.ownerId, disposition: entry.disposition, allocationCount: entry.allocations.length, evidenceReference: entry.evidenceReference });
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    began = false;
    // Keep plan + output in an access-controlled operator change record.
    console.log(JSON.stringify({ outcome: apply ? "committed" : "dry_run_no_writes", planSha256, reviewedBy: plan.reviewedBy, reviewedAt: plan.reviewedAt, completedAt: new Date().toISOString(), stockChanged: false, report }, null, 2));
  } finally {
    if (began) await client.query("ROLLBACK");
    await client.end();
  }
}
main().catch((error: any) => {
  // Driver errors can include connection details; do not print their payload.
  console.error(error.code || error.severity ? "Database operation failed; no partial plan committed. Investigate securely and rerun dry-run." : error.message);
  process.exitCode = 1;
});