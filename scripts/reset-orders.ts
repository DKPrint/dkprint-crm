/**
 * Delete all orders and related rows. Keeps users, clients, categories, transitions.
 *
 *   CONFIRM_RESET_ORDERS=yes npm run seed:reset-orders
 */
import { sql } from '../src/lib/db';

async function main() {
  if (process.env.CONFIRM_RESET_ORDERS !== 'yes') {
    console.error('Set CONFIRM_RESET_ORDERS=yes to wipe all orders.');
    process.exit(1);
  }

  const before = (await sql`SELECT count(*)::int AS n FROM orders`) as Array<{ n: number }>;
  const n = before[0]?.n ?? 0;
  console.log(`Orders before: ${n}`);

  await sql`UPDATE notification_log SET order_id = NULL WHERE order_id IS NOT NULL`;
  await sql`DELETE FROM files`;
  await sql`DELETE FROM comments`;
  await sql`DELETE FROM order_audit_logs`;
  await sql`DELETE FROM order_status_events`;
  await sql`UPDATE tasks SET order_id = NULL WHERE order_id IS NOT NULL`;
  await sql`DELETE FROM order_items`;
  await sql`DELETE FROM orders`;
  await sql`DELETE FROM order_daily_sequences`;

  const after = (await sql`SELECT count(*)::int AS n FROM orders`) as Array<{ n: number }>;
  console.log(`Orders after: ${after[0]?.n ?? 0}`);
  console.log('Order daily sequences cleared. Users/clients kept.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
