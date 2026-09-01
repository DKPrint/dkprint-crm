/**
 * Full staging QA reset: wipe operational data, keep only super-admin from env, seed demo roster.
 *
 * Usage:
 *   CONFIRM_WIPE_QA=yes npm run seed:wipe-qa
 *
 * Requires: DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 * Optional: SEED_DEMO_PASSWORD (default Demo123!)
 *
 * Safety: refuses when R2_ENV=prod unless CONFIRM_WIPE_PROD=yes
 *
 * Keeps: status_transitions, sla_goals, legacy flat categories (seed reference data).
 * Wipes: orders, clients, catalog_*, tasks, push, notification_log, all users then recreates admin + demo.
 */
import bcrypt from 'bcryptjs';
import { sql } from '../src/lib/db';

const DEFAULT_DEMO_PASSWORD = 'Demo123!';

type DemoUser = {
  email: string;
  displayName: string;
  role: 'photo_center' | 'production' | 'designer' | 'courier';
  clientName?: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    email: 'point-a@dkprint.local',
    displayName: 'Точка А',
    role: 'photo_center',
    clientName: 'Точка А',
  },
  {
    email: 'point-b@dkprint.local',
    displayName: 'Точка Б',
    role: 'photo_center',
    clientName: 'Точка Б',
  },
  {
    email: 'production@dkprint.local',
    displayName: 'Производство',
    role: 'production',
  },
  {
    email: 'designer@dkprint.local',
    displayName: 'Дизайнер',
    role: 'designer',
  },
  {
    email: 'courier@dkprint.local',
    displayName: 'Курьер',
    role: 'courier',
  },
];

async function wipeCatalogCategories(): Promise<void> {
  for (let pass = 0; pass < 32; pass += 1) {
    const remaining = (await sql`
      SELECT count(*)::int AS n FROM catalog_categories
    `) as Array<{ n: number }>;
    if ((remaining[0]?.n ?? 0) === 0) return;

    await sql`
      DELETE FROM catalog_categories c
      WHERE NOT EXISTS (
        SELECT 1 FROM catalog_categories ch WHERE ch.parent_id = c.id
      )
    `;
  }
  throw new Error('catalog_categories wipe incomplete (deep tree?)');
}

async function wipeOperationalData(): Promise<void> {
  console.log('Wiping orders and related…');
  await sql`DELETE FROM notification_log`;
  await sql`DELETE FROM files`;
  await sql`DELETE FROM comments`;
  await sql`DELETE FROM order_audit_logs`;
  await sql`DELETE FROM order_status_events`;
  await sql`DELETE FROM order_items`;
  await sql`DELETE FROM orders`;
  await sql`DELETE FROM order_daily_sequences`;

  console.log('Wiping tasks, push, catalog…');
  await sql`DELETE FROM tasks`;
  await sql`DELETE FROM push_subscriptions`;
  await sql`DELETE FROM catalog_import_runs`;
  await sql`DELETE FROM catalog_product_consumables`;
  await sql`DELETE FROM catalog_products`;
  await sql`DELETE FROM catalog_consumables`;
  await wipeCatalogCategories();

  console.log('Wiping clients and users…');
  await sql`UPDATE users SET client_id = NULL`;
  await sql`UPDATE clients SET user_id = NULL`;
  await sql`DELETE FROM clients`;
  await sql`DELETE FROM users`;
}

async function createSuperAdmin(email: string, password: string): Promise<string> {
  const passwordHash = await bcrypt.hash(password, 12);
  const displayName = email.split('@')[0] || email;

  const rows = await sql`
    INSERT INTO users (email, password_hash, display_name, role, is_active)
    VALUES (${email}, ${passwordHash}, ${displayName}, 'admin', true)
    RETURNING id
  `;
  const userId = rows[0]!.id as string;

  await sql`
    INSERT INTO permission_overrides (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;

  return userId;
}

async function seedDemoRoster(demoPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  for (const demo of DEMO_USERS) {
    if (demo.role === 'photo_center' && demo.clientName) {
      const userRows = await sql`
        INSERT INTO users (email, password_hash, display_name, role, is_active)
        VALUES (${demo.email}, ${passwordHash}, ${demo.displayName}, 'photo_center', true)
        RETURNING id
      `;
      const userId = userRows[0]!.id as string;

      await sql`
        INSERT INTO permission_overrides (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `;

      const clientRows = await sql`
        INSERT INTO clients (name, user_id)
        VALUES (${demo.clientName}, ${userId})
        RETURNING id
      `;
      const clientId = clientRows[0]!.id as string;

      await sql`
        UPDATE users SET client_id = ${clientId}, updated_at = now()
        WHERE id = ${userId}
      `;
    } else {
      const userRows = await sql`
        INSERT INTO users (email, password_hash, display_name, role, is_active)
        VALUES (${demo.email}, ${passwordHash}, ${demo.displayName}, ${demo.role}, true)
        RETURNING id
      `;
      const userId = userRows[0]!.id as string;
      await sql`
        INSERT INTO permission_overrides (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `;
    }
  }
}

async function main() {
  if (process.env.CONFIRM_WIPE_QA !== 'yes') {
    console.error('Refusing to run: set CONFIRM_WIPE_QA=yes for full staging wipe + seed.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.');
    process.exit(1);
  }

  const r2Env = process.env.R2_ENV?.trim();
  if (r2Env === 'prod' && process.env.CONFIRM_WIPE_PROD !== 'yes') {
    console.error(
      'Refusing prod wipe: R2_ENV=prod. Set CONFIRM_WIPE_PROD=yes only if you intend to wipe production DB.',
    );
    process.exit(1);
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
  if (demoPassword.length < 6) {
    console.error('SEED_DEMO_PASSWORD must be at least 6 characters.');
    process.exit(1);
  }

  console.log('QA wipe + seed starting…');
  if (r2Env) console.log(`R2_ENV=${r2Env}`);
  console.log(`Super-admin after wipe: ${adminEmail}`);

  await wipeOperationalData();

  const adminId = await createSuperAdmin(adminEmail, adminPassword);
  console.log(`Super-admin created: ${adminEmail} (${adminId})`);

  await seedDemoRoster(demoPassword);

  console.log('\nDemo roster (§22 manual smoke):');
  console.log(`  Demo password: ${demoPassword}`);
  for (const demo of DEMO_USERS) {
    const note = demo.clientName ? ` → client «${demo.clientName}»` : '';
    console.log(`  ${demo.email}  (${demo.role})${note}`);
  }
  console.log('\nDone. R2 objects are NOT deleted — orphan keys may remain until bucket cleanup.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
