/**
 * Seed first admin user (TZ §19.1.4).
 * Usage: npm run seed:admin  (loads .env via --env-file)
 * Requires: DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 */
import bcrypt from 'bcryptjs';
import { sql } from '../src/lib/db';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.');
    process.exit(1);
  }

  const existing = await sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`Admin already exists for ${email} — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const displayName = email.split('@')[0] || email;

  const inserted = await sql`
    INSERT INTO users (email, password_hash, display_name, role)
    VALUES (${email}, ${passwordHash}, ${displayName}, 'admin')
    RETURNING id
  `;

  const userId = inserted[0]?.id as string;
  await sql`
    INSERT INTO permission_overrides (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;

  console.log(`Admin created: ${email} (${userId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
