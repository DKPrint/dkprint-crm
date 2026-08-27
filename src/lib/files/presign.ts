import { randomUUID } from 'node:crypto';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertOrderAccess } from '@/lib/auth/assertOrderAccess';
import { sql } from '@/lib/db';
import { PRESIGN_TTL_SECONDS } from './constants';
import { assertNotCourier, assertOrderAllowsUpload, canUploadBlock } from './permissions';
import { getR2Env, presignPut } from './r2-client';
import { safeFileName } from './safe-name';
import { buildStorageKey } from './storage-key';
import { presignSchema } from './schemas';
import type { z } from 'zod';

type PresignInput = z.infer<typeof presignSchema>;

export async function presignUpload(
  user: SessionUser,
  input: PresignInput,
): Promise<{ fileId: string; uploadUrl: string; storageKey: string }> {
  assertNotCourier(user);
  if (!canUploadBlock(user, input.block)) {
    throw new Error('forbidden');
  }

  const orderRows = await sql`
    SELECT id, order_number, client_id, status, deleted_at
    FROM orders
    WHERE id = ${input.orderId}
    LIMIT 1
  `;
  const order = orderRows[0] as
    | {
        id: string;
        order_number: string;
        client_id: string;
        status: string;
        deleted_at: string | null;
      }
    | undefined;
  if (!order) throw new Error('order_not_found');

  assertOrderAccess(user, order);
  assertOrderAllowsUpload(order);

  const itemRows = await sql`
    SELECT id FROM order_items
    WHERE id = ${input.itemId} AND order_id = ${input.orderId}
    LIMIT 1
  `;
  if (!itemRows[0]) throw new Error('item_not_found');

  const safeName = safeFileName(input.filename);
  const fileId = randomUUID();
  const storageKey = buildStorageKey({
    env: getR2Env(),
    orderNumber: order.order_number,
    itemId: input.itemId,
    block: input.block,
    fileId,
    safeName,
  });

  await sql`
    INSERT INTO files (
      id, order_id, order_item_id, block, storage_key,
      original_name, mime_type, size_bytes, upload_status, uploaded_by_user_id
    ) VALUES (
      ${fileId}, ${input.orderId}, ${input.itemId}, ${input.block}, ${storageKey},
      ${input.filename}, ${input.mimeType}, ${input.sizeBytes}, 'pending', ${user.id}
    )
  `;

  const uploadUrl = await presignPut({
    storageKey,
    mimeType: input.mimeType,
    ttlSeconds: PRESIGN_TTL_SECONDS,
  });

  console.info('[files] presign', {
    order_number: order.order_number,
    storage_key: storageKey,
    file_id: fileId,
  });

  return { fileId, uploadUrl, storageKey };
}
