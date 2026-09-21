/**
 * Opt-in, local disposable PostgreSQL ONLY. Never imports app DB/config.
 * Runs actual inventory helpers against both real PostgreSQL drivers.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import postgres from "postgres";
import { drizzle as nodeDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { mutateInventory, recordInventory, restoreInventory, transferInventory } from "../shared/legacy-inventory";

const args = process.argv.slice(2);
const usage = "env -i PATH=\"$PATH\" HOME=\"$HOME\" npx tsx script/legacy-inventory-postgres-acceptance.ts --disposable-local-only --database-url postgresql://inventory_test@127.0.0.1:5432/inventory_disposable_test";
if (args.includes("--help")) { console.log(usage); process.exit(0); }
if (!args.includes("--disposable-local-only")) throw new Error(`Explicit disposable opt-in required. ${usage}`);
// Inspect names only, never read application credentials. A clean environment is mandatory.
if (Object.keys(process.env).some(k => /^(PG[A-Z_]+)$|DATABASE|SUPABASE|REDOTPAY|SECRET|TOKEN|PASSWORD|API_KEY|INVENTORY_RECONCILIATION_URL/.test(k))) {
  throw new Error("Refusing application/DB/provider environment. Invoke with env -i as documented.");
}
const raw = args[args.indexOf("--database-url") + 1];
if (!args.includes("--database-url") || !raw) throw new Error("Explicit disposable database URL required");
const url = new URL(raw);
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  || !/^\/inventory_disposable_[a-z0-9_]+$/.test(url.pathname) || !url.username || url.password || url.search || url.hash) {
  throw new Error("Only loopback inventory_disposable_* databases with explicit user, no password or URL options are permitted");
}
const schema = `inventory_test_${randomUUID().replaceAll("-", "")}`;
// Explicit password callbacks prevent implicit ~/.pgpass/ambient credential lookup.
const connection = { host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432), user: decodeURIComponent(url.username), database: url.pathname.slice(1), password: () => "", ssl: false as const };
const observer = new pg.Pool({ ...connection, max: 1, application_name: schema + "_observer" });
let created = false;
const normalize = (r: any) => Array.isArray(r) ? r : r.rows;
const line = (id: string, qty = 1, extra = {}) => ({ productId: id, qty, size: "S", color: "Blue", ...extra });
try {
  const identity = await observer.query("SELECT current_database() AS name, host(inet_server_addr()) AS address");
  assert.equal(identity.rows[0].name, url.pathname.slice(1));
  assert.ok(["127.0.0.1", "::1"].includes(identity.rows[0].address), "Server must itself report a loopback address");
  const tables = await observer.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f') LIMIT 1");
  assert.equal(tables.rowCount, 0, "Disposable DB must contain no user tables/views; refusing an application DB");
  await observer.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await observer.query(`CREATE TABLE "${schema}".products (id text PRIMARY KEY, stock integer NOT NULL, variant_stock jsonb NOT NULL DEFAULT '{}', is_pre_order boolean DEFAULT true, pre_order_stock integer, pre_order_variant_stock jsonb NOT NULL DEFAULT '{}', pre_order_deadline text);
    CREATE TABLE "${schema}".legacy_inventory_reservations (owner_type text NOT NULL, owner_id text NOT NULL, allocations jsonb NOT NULL, restored_at timestamptz, PRIMARY KEY(owner_type,owner_id));
    CREATE TABLE "${schema}".test_orders (id text PRIMARY KEY);
    CREATE TABLE "${schema}".test_payments (id text PRIMARY KEY, state text NOT NULL);`);
  for (const driver of ["node-postgres", "postgres-js"]) {
    const appName = `${schema}_${driver}`;
    const pool = driver === "node-postgres" ? new pg.Pool({ ...connection, max: 4, options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=5000`, application_name: appName }) : null;
    const client = driver === "postgres-js" ? postgres({ ...connection, max: 4, connection: { search_path: schema, application_name: appName, statement_timeout: "10000", lock_timeout: "5000" } }) : null;
    const db: any = pool ? nodeDrizzle(pool) : postgresDrizzle(client!);
    const reset = async () => {
      await db.execute(sql`TRUNCATE products, legacy_inventory_reservations, test_orders, test_payments`);
      await db.execute(sql`INSERT INTO products(id,stock) VALUES ('a',5),('b',5)`);
    };
    const stock = async (id = "a") => normalize(await db.execute(sql`SELECT * FROM products WHERE id=${id}`))[0];
    // Implements the actual RedotPay reservation's ORDER BY/FOR UPDATE locking
    // and stock SQL, without contacting a provider or claiming HTTP acceptance.
    const redotpayReserve = async (tx: any, qty: number, preorder = false) => {
      const products = normalize(await tx.execute(sql`SELECT * FROM products ORDER BY id FOR UPDATE`));
      const p = products[0];
      const map = preorder ? p.pre_order_variant_stock : p.variant_stock;
      if (Object.keys(map).length) {
        assert.ok(map["S-Blue"] >= qty, "RedotPay insufficient variant stock");
        map["S-Blue"] -= qty;
        if (preorder) await tx.execute(sql`UPDATE products SET pre_order_variant_stock=${JSON.stringify(map)}::jsonb WHERE id='a'`);
        else await tx.execute(sql`UPDATE products SET variant_stock=${JSON.stringify(map)}::jsonb WHERE id='a'`);
      } else if (!preorder) {
        assert.ok(p.stock >= qty, "RedotPay insufficient stock");
        await tx.execute(sql`UPDATE products SET stock=${p.stock - qty} WHERE id='a'`);
      }
      if (preorder && p.pre_order_stock !== null) {
        assert.ok(p.pre_order_stock >= qty, "RedotPay insufficient preorder cap");
        await tx.execute(sql`UPDATE products SET pre_order_stock=${p.pre_order_stock - qty} WHERE id='a'`);
      }
    };
    const race = async (first: (tx: any) => Promise<void>, second: () => Promise<any>) => {
      let unlock!: () => void;
      let locked!: () => void;
      const gate = new Promise<void>(r => unlock = r);
      const ready = new Promise<void>(r => locked = r);
      const holding = db.transaction(async (tx: any) => { await first(tx); locked(); await gate; });
      await Promise.race([ready, holding.then(() => { throw new Error("First transaction did not signal"); })]);
      let settled = false;
      const contender = second().then(value => ({ value }), error => ({ error })).finally(() => { settled = true; });
      try {
        let blocked = false;
        for (let i = 0; i < 100 && !blocked; i++) {
          const waiting = await observer.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [appName]);
          blocked = !!waiting.rowCount;
          if (!blocked) await new Promise(r => setTimeout(r, 20));
        }
        assert.ok(blocked && !settled, "Contender must actually wait on PostgreSQL row lock");
      } finally { unlock(); }
      await holding;
      return contender;
    };
    try {
      await reset();
      // COD/bank wins; RedotPay cannot overwrite its reservation.
      const lose = await race(async tx => {
        await recordInventory(tx, "order", "cod", await mutateInventory(tx, [line("a", 4)]));
      }, () => db.transaction((tx: any) => redotpayReserve(tx, 2)));
      assert.ok("error" in lose);
      assert.equal((await stock()).stock, 1);
      // Reverse winner: POS sees the committed provider reservation.
      await reset();
      const posLose = await race(tx => redotpayReserve(tx, 4), () => db.transaction(async (tx: any) => {
        await recordInventory(tx, "pos", "sale", await mutateInventory(tx, [line("a", 2)], false, true));
      }));
      assert.ok("error" in posLose);
      assert.equal((await stock()).stock, 1);
      // Second-product/order-insert failures roll back all deductions and ledger.
      await reset();
      await assert.rejects(db.transaction(async (tx: any) => {
        await mutateInventory(tx, [line("a", 2), line("b", 6)]);
      }));
      assert.equal((await stock()).stock, 5);
      await assert.rejects(db.transaction(async (tx: any) => {
        await recordInventory(tx, "order", "bad", await mutateInventory(tx, [line("a", 2)]));
        await tx.execute(sql`INSERT INTO test_orders VALUES ('duplicate'),('duplicate')`);
      }));
      assert.equal((await stock()).stock, 5);
      assert.equal(normalize(await db.execute(sql`SELECT * FROM legacy_inventory_reservations`)).length, 0);
      // A mid-restore configuration error rolls back prior restored lines and
      // leaves the ledger outstanding, rather than granting partial stock.
      await db.execute(sql`UPDATE products SET variant_stock='{"S-Blue":3}'::jsonb WHERE id='b'`);
      await db.transaction(async (tx: any) => recordInventory(tx, "order", "restore-failure", await mutateInventory(tx, [line("a", 2), line("b")])));
      await db.execute(sql`UPDATE products SET variant_stock='{}'::jsonb WHERE id='b'`);
      await assert.rejects(db.transaction((tx: any) => restoreInventory(tx, "order", "restore-failure")));
      assert.equal((await stock()).stock, 3);
      assert.equal(normalize(await db.execute(sql`SELECT restored_at FROM legacy_inventory_reservations WHERE owner_id='restore-failure'`))[0].restored_at, null);
      await reset();
      // Two independent cancellation requests restore exactly once.
      await db.transaction(async (tx: any) => recordInventory(tx, "order", "bank", await mutateInventory(tx, [line("a", 3)])));
      await Promise.all([db.transaction((tx: any) => restoreInventory(tx, "order", "bank")), db.transaction((tx: any) => restoreInventory(tx, "order", "bank"))]);
      assert.equal((await stock()).stock, 5);
      // Restoration races provider reservation under compatible product locks.
      await db.transaction(async (tx: any) => recordInventory(tx, "order", "restore-race", await mutateInventory(tx, [line("a", 3)])));
      const restoredRace = await race(tx => restoreInventory(tx, "order", "restore-race"), () => db.transaction((tx: any) => redotpayReserve(tx, 4)));
      assert.ok(!("error" in restoredRace));
      assert.equal((await stock()).stock, 1);
      // Provider close/release uses payment -> product locks and terminal state.
      // Its release races a bank checkout; duplicate release cannot inflate stock.
      await reset();
      await db.transaction(async (tx: any) => {
        await redotpayReserve(tx, 3);
        await tx.execute(sql`INSERT INTO test_payments VALUES ('payment','pending')`);
      });
      const providerRelease = async (tx: any) => {
        const payment = normalize(await tx.execute(sql`SELECT * FROM test_payments WHERE id='payment' FOR UPDATE`))[0];
        if (payment.state === "closed") return;
        await tx.execute(sql`SELECT * FROM products WHERE id='a' FOR UPDATE`);
        await tx.execute(sql`UPDATE products SET stock=stock+3 WHERE id='a'`);
        await tx.execute(sql`UPDATE test_payments SET state='closed' WHERE id='payment'`);
      };
      const closeRace = await race(providerRelease, () => db.transaction(async (tx: any) => recordInventory(tx, "order", "after-close", await mutateInventory(tx, [line("a", 4)]))));
      assert.ok(!("error" in closeRace));
      await Promise.all([db.transaction(providerRelease), db.transaction(providerRelease)]);
      assert.equal((await stock()).stock, 1);
      // POS ownership transfer does not deduct again; order cancellation restores.
      await reset();
      await db.transaction(async (tx: any) => recordInventory(tx, "pos", "pos-1", await mutateInventory(tx, [line("a", 2)], false, true)));
      await db.transaction((tx: any) => transferInventory(tx, "pos-1", "converted"));
      await assert.rejects(db.transaction((tx: any) => transferInventory(tx, "pos-1", "duplicate")));
      assert.equal((await stock()).stock, 3);
      await db.transaction((tx: any) => restoreInventory(tx, "order", "converted"));
      assert.equal((await stock()).stock, 5);
      // Preorder variant + total cap, duplicate-line aggregation and rollback.
      await db.execute(sql`UPDATE products SET pre_order_stock=3,pre_order_variant_stock='{"S-Blue":3}'::jsonb WHERE id='a'`);
      await assert.rejects(db.transaction((tx: any) => mutateInventory(tx, [line("a", 2, { isPreOrder: true }), line("a", 2, { isPreOrder: true })])));
      assert.equal((await stock()).pre_order_stock, 3);
      await db.transaction(async (tx: any) => recordInventory(tx, "order", "preorder", await mutateInventory(tx, [line("a", 2, { isPreOrder: true })])));
      await db.transaction((tx: any) => restoreInventory(tx, "order", "preorder"));
      assert.equal((await stock()).pre_order_variant_stock["S-Blue"], 3);
      const preorderRace = await race(tx => redotpayReserve(tx, 2, true), () => db.transaction((tx: any) => mutateInventory(tx, [line("a", 2, { isPreOrder: true })])));
      assert.ok("error" in preorderRace);
      assert.equal((await stock()).pre_order_stock, 1);
      assert.equal((await stock()).pre_order_variant_stock["S-Blue"], 1);
      await reset();
      await db.execute(sql`UPDATE products SET variant_stock='{"S-Blue":3}'::jsonb WHERE id='a'`);
      const variantRace = await race(async tx => { await mutateInventory(tx, [line("a", 2)]); }, () => db.transaction((tx: any) => redotpayReserve(tx, 2)));
      assert.ok("error" in variantRace);
      assert.equal((await stock()).variant_stock["S-Blue"], 1);
      // Reversed cart order still acquires products in the same lock order.
      await reset();
      await Promise.all([
        db.transaction((tx: any) => mutateInventory(tx, [line("b"), line("a")])),
        db.transaction((tx: any) => mutateInventory(tx, [line("a"), line("b")])),
      ]);
      assert.equal((await stock("a")).stock, 3);
      assert.equal((await stock("b")).stock, 3);
      console.log(`${driver}: real row-lock races, rollback, idempotent restoration, POS transfer and preorder assertions passed`);
    } finally {
      if (pool) await pool.end();
      if (client) await client.end();
    }
  }
} finally {
  if (created) await observer.query(`DROP SCHEMA "${schema}" CASCADE`);
  await observer.end();
}