/**
 * Reset non-admin users and seed demo roster (photo centers + ops roles).
 *
 * Usage:
 *   CONFIRM_SEED_DEMO=yes npm run seed:demo
 *
 * Requires: DATABASE_URL, at least one admin user (npm run seed:admin first).
 * Optional: SEED_DEMO_PASSWORD (default Demo123!)
 *
 * Keeps all role=admin users. Reassigns FK references from deleted users to
 * the primary admin, then creates fixed demo accounts.
 */
import bcrypt from 'bcryptjs';
import { sql } from '../src/lib/db';

const DEFAULT_PASSWORD = 'Demo123!';

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

async function main() {
  if (process.env.CONFIRM_SEED_DEMO !== 'yes') {
    console.error(
      'Refusing to run: set CONFIRM_SEED_DEMO=yes to reset non-admin users and seed demos.',
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const password = process.env.SEED_DEMO_PASSWORD?.trim() || DEFAULT_PASSWORD;
  if (password.length < 6) {
    console.error('SEED_DEMO_PASSWORD must be at least 6 characters.');
    process.exit(1);
  }

  const adminRows = (await sql`
    SELECT id, email FROM users WHERE role = 'admin' AND is_active = true ORDER BY created_at ASC
  `) as Array<{ id: string; email: string }>;

  if (adminRows.length === 0) {
    console.error('No admin user found. Run `npm run seed:admin` first.');
    process.exit(1);
  }

  const adminId = adminRows[0]!.id;
  console.log(`Keeping admin(s): ${adminRows.map((a) => a.email).join(', ')}`);
  console.log(`Reassigning FK ownership to admin ${adminId}`);

  const nonAdmin = (await sql`
    SELECT id, email, role FROM users WHERE role <> 'admin'
  `) as Array<{ id: string; email: string; role: string }>;

  if (nonAdmin.length > 0) {
    console.log(`Removing ${nonAdmin.length} non-admin user(s)…`);
    const ids = nonAdmin.map((u) => u.id);

    // Break clients ↔ users cycle
    await sql`
      UPDATE users SET client_id = NULL WHERE id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE clients SET user_id = NULL WHERE user_id = ANY(${ids}::uuid[])
    `;

    // Reassign NOT NULL user FKs to admin so history stays
    await sql`
      UPDATE orders SET created_by_user_id = ${adminId}
      WHERE created_by_user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE orders SET deleted_by_user_id = ${adminId}
      WHERE deleted_by_user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE order_status_events SET changed_by_user_id = ${adminId}
      WHERE changed_by_user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE order_audit_logs SET user_id = ${adminId}
      WHERE user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE files SET uploaded_by_user_id = ${adminId}
      WHERE uploaded_by_user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE comments SET user_id = ${adminId}
      WHERE user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE tasks SET assignee_user_id = ${adminId}
      WHERE assignee_user_id = ANY(${ids}::uuid[])
    `;
    await sql`
      UPDATE tasks SET creator_user_id = ${adminId}
      WHERE creator_user_id = ANY(${ids}::uuid[])
    `;

    // push_subscriptions / permission_overrides cascade on user delete
    await sql`DELETE FROM users WHERE id = ANY(${ids}::uuid[])`;
    console.log('Non-admin users deleted.');
  } else {
    console.log('No non-admin users to remove.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const created: Array<{ email: string; role: string; client?: string }> = [];

  for (const demo of DEMO_USERS) {
    const existing = await sql`
      SELECT id FROM users WHERE email = ${demo.email} LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`Skip existing ${demo.email}`);
      continue;
    }

    if (demo.role === 'photo_center' && demo.clientName) {
      const userRows = await sql`
        INSERT INTO users (email, password_hash, display_name, role)
        VALUES (${demo.email}, ${passwordHash}, ${demo.displayName}, 'photo_center')
        RETURNING id
      `;
      const userId = userRows[0]!.id as string;

      await sql`
        INSERT INTO permission_overrides (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `;

      // Prefer unused client with same name; else create
      const freeClient = (await sql`
        SELECT id FROM clients
        WHERE name = ${demo.clientName} AND user_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
      `) as Array<{ id: string }>;

      let clientId: string;
      if (freeClient[0]) {
        clientId = freeClient[0].id;
        await sql`
          UPDATE clients SET user_id = ${userId} WHERE id = ${clientId}
        `;
      } else {
        const clientRows = await sql`
          INSERT INTO clients (name, user_id)
          VALUES (${demo.clientName}, ${userId})
          RETURNING id
        `;
        clientId = clientRows[0]!.id as string;
      }

      await sql`
        UPDATE users SET client_id = ${clientId}, updated_at = now()
        WHERE id = ${userId}
      `;

      created.push({ email: demo.email, role: demo.role, client: demo.clientName });
    } else {
      const userRows = await sql`
        INSERT INTO users (email, password_hash, display_name, role)
        VALUES (${demo.email}, ${passwordHash}, ${demo.displayName}, ${demo.role})
        RETURNING id
      `;
      const userId = userRows[0]!.id as string;
      await sql`
        INSERT INTO permission_overrides (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `;
      created.push({ email: demo.email, role: demo.role });
    }
  }

  console.log('\nDemo users ready (password shared):');
  console.log(`  Password: ${password}`);
  for (const demo of DEMO_USERS) {
    const note = demo.clientName ? ` → client «${demo.clientName}»` : '';
    console.log(`  ${demo.email}  (${demo.role})${note}`);
  }
  if (created.length === 0) {
    console.log('(all already existed)');
  } else {
    console.log(`Created ${created.length} user(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
