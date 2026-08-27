import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertOrderAccess } from '@/lib/auth/assertOrderAccess';
import { DOWNLOAD_TTL_SECONDS } from './constants';
import { getFileWithOrder } from './queries';
import { assertNotCourier } from './permissions';
import { presignGet } from './r2-client';

export async function getDownloadUrl(
  user: SessionUser,
  fileId: string,
): Promise<{ downloadUrl: string }> {
  assertNotCourier(user);

  const row = await getFileWithOrder(fileId);
  assertOrderAccess(user, {
    client_id: row.client_id,
    status: row.order_status,
    deleted_at: row.deleted_at,
  });

  if (row.upload_status !== 'confirmed') {
    throw new Error('file_not_ready');
  }

  const downloadUrl = await presignGet({
    storageKey: row.storage_key,
    ttlSeconds: DOWNLOAD_TTL_SECONDS,
  });

  console.info('[files] download', {
    order_number: row.order_number,
    storage_key: row.storage_key,
    file_id: fileId,
  });

  return { downloadUrl };
}
