import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sendOrderEmailOnce } from "../server/lib/order-email-notifications.js";

test("customer confirmation remains complete while a separate admin notification retries", async () => {
  const dialect = new PgDialect();
  const sent = new Set<string>();
  const db: any = {
    execute: async (query: any) => {
      const { sql, params } = dialect.sqlToQuery(query);
      if (sql.startsWith("SELECT 1 FROM order_email_notifications")) {
        return sent.has(`${params[0]}:${params[1]}`) ? [{ "?column?": 1 }] : [];
      }
      if (sql.startsWith("INSERT INTO order_email_notifications")) {
        sent.add(`${params[0]}:${params[1]}`);
      }
      return [];
    },
    transaction: async (fn: any) => fn(db),
  };
  const order = { id: "o1" };
  let customerAttempts = 0;
  let adminAttempts = 0;

  await sendOrderEmailOnce(db, order, "confirmation:customer", async () => { customerAttempts++; });
  await assert.rejects(() => sendOrderEmailOnce(db, order, "confirmation:admin", async () => {
    adminAttempts++;
    throw new Error("sales mailbox unavailable");
  }));

  await sendOrderEmailOnce(db, order, "confirmation:customer", async () => { customerAttempts++; });
  await sendOrderEmailOnce(db, order, "confirmation:admin", async () => { adminAttempts++; });

  assert.equal(customerAttempts, 1);
  assert.equal(adminAttempts, 2);
  assert.deepEqual([...sent].sort(), ["o1:confirmation:admin", "o1:confirmation:customer"]);
});