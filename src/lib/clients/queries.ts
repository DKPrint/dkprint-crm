import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { listOrders } from '@/lib/orders/queries';
import {
  assertClientCreateAccess,
  assertClientPatchAccess,
  assertClientsListAccess,
} from './access';
import type { CreateClientInput, PatchClientInput } from './schemas';

type DbClient = {
  id: string;
  name: string;
  user_id: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
  user_email: string | null;
  user_display_name: string | null;
};

export type Client = {
  id: string;
  name: string;
  userId: string | null;
  notes: string | null;
  createdAt: string;
  deletedAt: string | null;
  isPhotoCenter: boolean;
  linkedUserEmail: string | null;
  linkedUserDisplayName: string | null;
};

function serializeClient(row: DbClient): Client {
  return {
    id: row.id,
    name: row.name,
    userId: row.user_id,
    notes: row.notes,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    isPhotoCenter: row.user_id != null,
    linkedUserEmail: row.user_email,
    linkedUserDisplayName: row.user_display_name,
  };
}

export async function listClients(
  user: SessionUser,
  filters: { q?: string; includeDeleted?: boolean } = {},
): Promise<Client[]> {
  assertClientsListAccess(user);
  const q = filters.q?.trim() ?? '';
  const pattern = q ? `%${q}%` : null;
  const includeDeleted = user.role === 'admin' && filters.includeDeleted === true;

  const rows = (await sql`
    SELECT
      c.id,
      c.name,
      c.user_id,
      c.notes,
      c.created_at,
      c.deleted_at,
      u.email AS user_email,
      u.display_name AS user_display_name
    FROM clients c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE
      (${includeDeleted} = true OR c.deleted_at IS NULL)
      AND (
        (${pattern}::text IS NULL)
        OR c.name ILIKE ${pattern}
        OR COALESCE(c.notes, '') ILIKE ${pattern}
        OR COALESCE(u.email, '') ILIKE ${pattern}
        OR COALESCE(u.display_name, '') ILIKE ${pattern}
      )
    ORDER BY c.name ASC
    LIMIT 500
  `) as DbClient[];

  return rows.map(serializeClient);
}

export async function getClientById(
  user: SessionUser,
  clientId: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<Client> {
  assertClientsListAccess(user);
  const includeDeleted = user.role === 'admin' && opts.includeDeleted === true;

  const rows = (await sql`
    SELECT
      c.id,
      c.name,
      c.user_id,
      c.notes,
      c.created_at,
      c.deleted_at,
      u.email AS user_email,
      u.display_name AS user_display_name
    FROM clients c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ${clientId}::uuid
      AND (${includeDeleted} = true OR c.deleted_at IS NULL)
    LIMIT 1
  `) as DbClient[];

  const row = rows[0];
  if (!row) throw new Error('client_not_found');
  return serializeClient(row);
}

/** External client only — user_id always NULL (TZ §7 / §19.3). */
export async function createClient(user: SessionUser, input: CreateClientInput): Promise<Client> {
  assertClientCreateAccess(user);
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const rows = (await sql`
    INSERT INTO clients (name, notes, user_id)
    VALUES (${input.name}, ${notes}, NULL)
    RETURNING id, name, user_id, notes, created_at
  `) as Omit<DbClient, 'user_email' | 'user_display_name'>[];

  const row = rows[0];
  if (!row) throw new Error('validation');
  return serializeClient({ ...row, user_email: null, user_display_name: null });
}

export async function patchClient(
  user: SessionUser,
  clientId: string,
  input: PatchClientInput,
): Promise<Client> {
  assertClientPatchAccess(user);

  const existingRows = (await sql`
    SELECT id, name, user_id, notes, created_at, deleted_at
    FROM clients
    WHERE id = ${clientId}::uuid
      AND deleted_at IS NULL
    LIMIT 1
  `) as Array<Omit<DbClient, 'user_email' | 'user_display_name'>>;

  const existing = existingRows[0];
  if (!existing) throw new Error('client_not_found');

  const name = input.name ?? existing.name;
  const notes =
    input.notes !== undefined ? (input.notes?.trim() ? input.notes.trim() : null) : existing.notes;

  if (name === existing.name && notes === existing.notes) {
    return getClientById(user, clientId);
  }

  const rows = (await sql`
    UPDATE clients
    SET name = ${name}, notes = ${notes}
    WHERE id = ${clientId}::uuid
    RETURNING id, name, user_id, notes, created_at
  `) as Omit<DbClient, 'user_email' | 'user_display_name'>[];

  const row = rows[0];
  if (!row) throw new Error('client_not_found');
  return getClientById(user, clientId);
}

export async function listClientOrders(
  user: SessionUser,
  clientId: string,
  opts: { includeDeleted?: boolean } = {},
) {
  await getClientById(user, clientId);
  return listOrders(user, {
    clientId,
    includeDeleted: user.role === 'admin' && opts.includeDeleted === true,
  });
}
