import { sql } from "drizzle-orm";

const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows || [];

export async function sendOrderEmailOnce(
  db: any,
  order: any,
  eventKey: string,
  send: () => Promise<unknown>,
) {
  if (!order?.id || !/^[a-z]+(?::[a-z_]+)?$/.test(eventKey)) {
    throw new Error("Invalid order email notification");
  }
  const sent = rows(await db.execute(sql`SELECT 1 FROM order_email_notifications
    WHERE order_id = ${order.id} AND event_key = ${eventKey} LIMIT 1`));
  if (sent.length) return;

  // Resend receives a stable provider idempotency key from the email adapter.
  // The durable row prevents later repeats after the provider's key expires.
  await send();

  await db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`order-email:${order.id}:${eventKey}`}, 0))`);
    await tx.execute(sql`INSERT INTO order_email_notifications(order_id, event_key)
      VALUES (${order.id}, ${eventKey}) ON CONFLICT (order_id, event_key) DO NOTHING`);
  });
}