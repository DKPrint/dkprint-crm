import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertOrderAccess } from '@/lib/auth/assertOrderAccess';
import { sql } from '@/lib/db';
import { getFileWithOrder, serializeFile } from './queries';
import { assertNotCourier } from './permissions';
import { objectExists } from './r2-client';
import type { FileMeta } from './queries';

export async function confirmUpload(
  user: SessionUser,
  fileId: string,
): Promise<{ file: FileMeta; uploadStatus: 'confirmed' | 'failed' }> {
  assertNotCourier(user);

  const row = await getFileWithOrder(fileId);
  assertOrderAccess(user, {
    client_id: row.client_id,
    status: row.order_status,
    deleted_at: row.deleted_at,
  });

  if (row.upload_status === 'confirmed') {
    console.info('[files] confirm idempotent', {
      order_number: row.order_number,
      storage_key: row.storage_key,
      file_id: fileId,
    });
    return { file: serializeFile(row), uploadStatus: 'confirmed' };
  }

  const exists = await objectExists(row.storage_key);
  const nextStatus = exists ? 'confirmed' : 'failed';

  if (nextStatus !== row.upload_status) {
    await sql`
      UPDATE files
      SET upload_status = ${nextStatus}
      WHERE id = ${fileId}
    `;
    row.upload_status = nextStatus;
  }

  console.info('[files] confirm', {
    order_number: row.order_number,
    storage_key: row.storage_key,
    file_id: fileId,
    upload_status: nextStatus,
  });

  return { file: serializeFile(row), uploadStatus: nextStatus };
}
