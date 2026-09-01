import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import type { PermissionFlags, Role } from '@/lib/auth/permissions';
import { assertAdminUsersAccess } from './access';
import { wouldRemoveLastActiveAdmin } from './guards';
import {
  flagsToApiPermissions,
  normalizePermissionOverridesForRole,
  permissionInputToFlags,
} from './permissions';
import type { CreateUserInput, PatchUserInput } from './schemas';

type DbUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  can_access_reports: boolean | null;
  can_edit_price: boolean | null;
  can_cancel_order: boolean | null;
  can_soft_delete_order: boolean | null;
  can_manage_sla: boolean | null;
  deny_access_reports: boolean | null;
  deny_edit_price: boolean | null;
  deny_cancel_order: boolean | null;
  deny_soft_delete_order: boolean | null;
  deny_manage_sla: boolean | null;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  clientId: string | null;
  clientName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: ReturnType<typeof flagsToApiPermissions>;
};

function rowToFlags(row: DbUserRow): PermissionFlags {
  return {
    can_access_reports: row.can_access_reports === true,
    can_edit_price: row.can_edit_price === true,
    can_cancel_order: row.can_cancel_order === true,
    can_soft_delete_order: row.can_soft_delete_order === true,
    can_manage_sla: row.can_manage_sla === true,
    deny_access_reports: row.deny_access_reports === true,
    deny_edit_price: row.deny_edit_price === true,
    deny_cancel_order: row.deny_cancel_order === true,
    deny_soft_delete_order: row.deny_soft_delete_order === true,
    deny_manage_sla: row.deny_manage_sla === true,
  };
}

function serializeUser(row: DbUserRow): AdminUser {
  const flags = rowToFlags(row);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    clientId: row.client_id,
    clientName: row.client_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    permissions: flagsToApiPermissions(flags),
  };
}

const userSelectSql = sql`
  u.id,
  u.email,
  u.display_name,
  u.role,
  u.client_id,
  u.is_active,
  u.created_at,
  u.updated_at,
  c.name AS client_name,
  po.can_access_reports,
  po.can_edit_price,
  po.can_cancel_order,
  po.can_soft_delete_order,
  po.can_manage_sla,
  po.deny_access_reports,
  po.deny_edit_price,
  po.deny_cancel_order,
  po.deny_soft_delete_order,
  po.deny_manage_sla
`;

async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS c
    FROM users
    WHERE role = 'admin' AND is_active = true AND id != ${excludeUserId}::uuid
  `) as Array<{ c: number }>;
  return rows[0]?.c ?? 0;
}

async function assertNotLastAdmin(userId: string, patch: PatchUserInput): Promise<void> {
  const rows = (await sql`
    SELECT role, is_active FROM users WHERE id = ${userId}::uuid LIMIT 1
  `) as Array<{ role: Role; is_active: boolean }>;
  const current = rows[0];
  if (!current) throw new Error('user_not_found');
  if (!wouldRemoveLastActiveAdmin({ role: current.role, isActive: current.is_active }, patch))
    return;
  const others = await countOtherActiveAdmins(userId);
  if (others < 1) throw new Error('last_admin');
}

async function fetchUserRow(userId: string): Promise<DbUserRow | null> {
  const rows = (await sql`
    SELECT ${userSelectSql}
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    LEFT JOIN permission_overrides po ON po.user_id = u.id
    WHERE u.id = ${userId}::uuid
    LIMIT 1
  `) as DbUserRow[];
  return rows[0] ?? null;
}

export async function listUsers(
  user: SessionUser,
  filters: { q?: string } = {},
): Promise<AdminUser[]> {
  assertAdminUsersAccess(user);
  const q = filters.q?.trim() ?? '';
  const pattern = q ? `%${q}%` : null;

  const rows = (await sql`
    SELECT ${userSelectSql}
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    LEFT JOIN permission_overrides po ON po.user_id = u.id
    WHERE
      (${pattern}::text IS NULL)
      OR u.email ILIKE ${pattern}
      OR u.display_name ILIKE ${pattern}
      OR COALESCE(c.name, '') ILIKE ${pattern}
    ORDER BY u.is_active DESC, u.display_name ASC
    LIMIT 500
  `) as DbUserRow[];

  return rows.map(serializeUser);
}

export async function getUserById(user: SessionUser, userId: string): Promise<AdminUser> {
  assertAdminUsersAccess(user);
  const row = await fetchUserRow(userId);
  if (!row) throw new Error('user_not_found');
  return serializeUser(row);
}

async function upsertPermissionOverrides(userId: string, role: Role, flags: PermissionFlags) {
  const normalized = normalizePermissionOverridesForRole(role, flags);
  await sql`
    INSERT INTO permission_overrides (
      user_id,
      can_access_reports,
      can_edit_price,
      can_cancel_order,
      can_soft_delete_order,
      can_manage_sla,
      deny_access_reports,
      deny_edit_price,
      deny_cancel_order,
      deny_soft_delete_order,
      deny_manage_sla,
      updated_at
    )
    VALUES (
      ${userId}::uuid,
      ${normalized.can_access_reports},
      ${normalized.can_edit_price},
      ${normalized.can_cancel_order},
      ${normalized.can_soft_delete_order},
      ${normalized.can_manage_sla},
      ${normalized.deny_access_reports},
      ${normalized.deny_edit_price},
      ${normalized.deny_cancel_order},
      ${normalized.deny_soft_delete_order},
      ${normalized.deny_manage_sla},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      can_access_reports = EXCLUDED.can_access_reports,
      can_edit_price = EXCLUDED.can_edit_price,
      can_cancel_order = EXCLUDED.can_cancel_order,
      can_soft_delete_order = EXCLUDED.can_soft_delete_order,
      can_manage_sla = EXCLUDED.can_manage_sla,
      deny_access_reports = EXCLUDED.deny_access_reports,
      deny_edit_price = EXCLUDED.deny_edit_price,
      deny_cancel_order = EXCLUDED.deny_cancel_order,
      deny_soft_delete_order = EXCLUDED.deny_soft_delete_order,
      deny_manage_sla = EXCLUDED.deny_manage_sla,
      updated_at = now()
  `;
}

/** photo_center: user + clients + client_id in one statement (TZ §19.3). */
async function insertPhotoCenterUser(
  input: CreateUserInput,
  passwordHash: string,
  flags: PermissionFlags,
): Promise<string> {
  const clientName = input.clientName!.trim();
  const rows = (await sql`
    WITH new_user AS (
      INSERT INTO users (email, password_hash, display_name, role)
      VALUES (
        ${input.email},
        ${passwordHash},
        ${input.displayName},
        'photo_center'
      )
      RETURNING id
    ),
    perm AS (
      INSERT INTO permission_overrides (
        user_id,
        can_access_reports,
        can_edit_price,
        can_cancel_order,
        can_soft_delete_order,
        can_manage_sla,
        deny_access_reports,
        deny_edit_price,
        deny_cancel_order,
        deny_soft_delete_order,
        deny_manage_sla
      )
      SELECT
        new_user.id,
        ${flags.can_access_reports},
        ${flags.can_edit_price},
        ${flags.can_cancel_order},
        ${flags.can_soft_delete_order},
        ${flags.can_manage_sla},
        ${flags.deny_access_reports},
        ${flags.deny_edit_price},
        ${flags.deny_cancel_order},
        ${flags.deny_soft_delete_order},
        ${flags.deny_manage_sla}
      FROM new_user
      RETURNING user_id
    ),
    new_client AS (
      INSERT INTO clients (name, user_id)
      SELECT ${clientName}, new_user.id FROM new_user
      RETURNING id
    ),
    linked AS (
      UPDATE users u
      SET client_id = new_client.id, updated_at = now()
      FROM new_client, new_user
      WHERE u.id = new_user.id
      RETURNING u.id
    )
    SELECT id FROM linked LIMIT 1
  `) as Array<{ id: string }>;

  const id = rows[0]?.id;
  if (!id) throw new Error('validation');
  return id;
}

async function insertStandardUser(
  input: CreateUserInput,
  passwordHash: string,
  flags: PermissionFlags,
): Promise<string> {
  const rows = (await sql`
    WITH new_user AS (
      INSERT INTO users (email, password_hash, display_name, role)
      VALUES (
        ${input.email},
        ${passwordHash},
        ${input.displayName},
        ${input.role}
      )
      RETURNING id
    ),
    perm AS (
      INSERT INTO permission_overrides (
        user_id,
        can_access_reports,
        can_edit_price,
        can_cancel_order,
        can_soft_delete_order,
        can_manage_sla,
        deny_access_reports,
        deny_edit_price,
        deny_cancel_order,
        deny_soft_delete_order,
        deny_manage_sla
      )
      SELECT
        new_user.id,
        ${flags.can_access_reports},
        ${flags.can_edit_price},
        ${flags.can_cancel_order},
        ${flags.can_soft_delete_order},
        ${flags.can_manage_sla},
        ${flags.deny_access_reports},
        ${flags.deny_edit_price},
        ${flags.deny_cancel_order},
        ${flags.deny_soft_delete_order},
        ${flags.deny_manage_sla}
      FROM new_user
      RETURNING user_id
    )
    SELECT id FROM new_user LIMIT 1
  `) as Array<{ id: string }>;

  const id = rows[0]?.id;
  if (!id) throw new Error('validation');
  return id;
}

export async function createUser(user: SessionUser, input: CreateUserInput): Promise<AdminUser> {
  assertAdminUsersAccess(user);

  const flags = normalizePermissionOverridesForRole(
    input.role,
    permissionInputToFlags(input.permissions),
  );
  const passwordHash = await bcrypt.hash(input.password, 12);

  let userId: string;
  try {
    if (input.role === 'photo_center') {
      userId = await insertPhotoCenterUser(input, passwordHash, flags);
    } else {
      userId = await insertStandardUser(input, passwordHash, flags);
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('email_taken');
    throw err;
  }

  return getUserById(user, userId);
}

async function linkPhotoCenterClient(userId: string, clientName: string): Promise<void> {
  const rows = (await sql`
    WITH new_client AS (
      INSERT INTO clients (name, user_id)
      VALUES (${clientName}, ${userId}::uuid)
      RETURNING id
    ),
    linked AS (
      UPDATE users u
      SET client_id = new_client.id, updated_at = now()
      FROM new_client
      WHERE u.id = ${userId}::uuid
      RETURNING u.id
    )
    SELECT id FROM linked LIMIT 1
  `) as Array<{ id: string }>;
  if (!rows[0]) throw new Error('validation');
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export async function patchUser(
  user: SessionUser,
  userId: string,
  input: PatchUserInput,
): Promise<AdminUser> {
  assertAdminUsersAccess(user);
  await assertNotLastAdmin(userId, input);

  const existing = await fetchUserRow(userId);
  if (!existing) throw new Error('user_not_found');

  const nextRole = input.role ?? existing.role;
  const nextActive = input.isActive ?? existing.is_active;

  if (
    wouldRemoveLastActiveAdmin(
      { role: existing.role, isActive: existing.is_active },
      { role: nextRole, isActive: nextActive },
    )
  ) {
    const others = await countOtherActiveAdmins(userId);
    if (others < 1) throw new Error('last_admin');
  }

  if (nextRole === 'photo_center' && !existing.client_id && input.clientName?.trim()) {
    await linkPhotoCenterClient(userId, input.clientName.trim());
  } else if (nextRole === 'photo_center' && !existing.client_id && !input.clientName?.trim()) {
    throw new Error('client_name_required');
  }

  const email = input.email ?? existing.email;
  const displayName = input.displayName ?? existing.display_name;
  let passwordHash: string | undefined;
  if (input.password) {
    passwordHash = await bcrypt.hash(input.password, 12);
  }

  try {
    if (passwordHash) {
      await sql`
        UPDATE users
        SET
          email = ${email},
          display_name = ${displayName},
          role = ${nextRole},
          is_active = ${nextActive},
          password_hash = ${passwordHash},
          updated_at = now()
        WHERE id = ${userId}::uuid
      `;
    } else {
      await sql`
        UPDATE users
        SET
          email = ${email},
          display_name = ${displayName},
          role = ${nextRole},
          is_active = ${nextActive},
          updated_at = now()
        WHERE id = ${userId}::uuid
      `;
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('email_taken');
    throw err;
  }

  if (input.permissions !== undefined) {
    const base = rowToFlags(existing);
    const merged = permissionInputToFlags(input.permissions, base);
    await upsertPermissionOverrides(userId, nextRole, merged);
  } else if (input.role !== undefined && input.role !== existing.role) {
    const base = rowToFlags(existing);
    await upsertPermissionOverrides(userId, nextRole, base);
  }

  return getUserById(user, userId);
}
