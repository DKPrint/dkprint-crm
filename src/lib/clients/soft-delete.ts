import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertClientSoftDeleteAccess } from './access';

export type SoftDeleteClientArgs = {
  clientId: string;
  user: SessionUser;
  comment: string;
};

/** Throws if client row cannot be soft-deleted (unit-testable). */
export function assertClientSoftDeletable(client: {
  user_id: string | null;
  deleted_at: string | null;
}): void {
  if (client.deleted_at) throw new Error('conflict');
  if (client.user_id != null) throw new Error('cannot_delete_photo_center_client');
}

/** Soft-delete external client (TZ §7). Photo_center clients (user_id set) are blocked. */
export async function softDeleteClient({
  clientId,
  user,
  comment,
}: SoftDeleteClientArgs): Promise<{ id: string }> {
  assertClientSoftDeleteAccess(user);

  const trimmed = comment.trim();
  if (!trimmed) throw new Error('validation');

  const rows = (await sql`
    SELECT id, user_id, deleted_at
    FROM clients
    WHERE id = ${clientId}::uuid
    LIMIT 1
  `) as Array<{ id: string; user_id: string | null; deleted_at: string | null }>;

  const client = rows[0];
  if (!client) throw new Error('client_not_found');
  assertClientSoftDeletable(client);

  const updated = (await sql`
    UPDATE clients
    SET
      deleted_at = now(),
      deleted_by_user_id = ${user.id}::uuid,
      delete_comment = ${trimmed}
    WHERE id = ${clientId}::uuid
      AND deleted_at IS NULL
      AND user_id IS NULL
    RETURNING id
  `) as Array<{ id: string }>;

  if (!updated[0]) throw new Error('conflict');
  return { id: updated[0].id };
}
