import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { sql } from '@/lib/db';
import { assertNotCourier } from './permissions';
import type { FileBlock, UploadStatus } from './constants';

export type DbFileRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  block: FileBlock;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: string | number;
  upload_status: UploadStatus;
  uploaded_by_user_id: string;
  created_at: string;
  order_number?: string;
  client_id?: string;
  order_status?: string;
  deleted_at?: string | null;
};

export type FileMeta = {
  id: string;
  orderId: string;
  orderItemId: string;
  block: FileBlock;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadStatus: UploadStatus;
  uploadedByUserId: string;
  createdAt: string;
};

export function serializeFile(row: DbFileRow): FileMeta {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    block: row.block,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadStatus: row.upload_status,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
  };
}

export async function listFilesForOrder(
  user: SessionUser,
  orderId: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<FileMeta[]> {
  assertNotCourier(user);

  const orderRows = await sql`
    SELECT id, client_id, status, deleted_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = orderRows[0] as
    { id: string; client_id: string; status: string; deleted_at: string | null } | undefined;
  if (!order) throw new Error('order_not_found');

  assertOrderAccess(user, order, opts);

  const rows = (await sql`
    SELECT
      f.id, f.order_id, f.order_item_id, f.block, f.storage_key,
      f.original_name, f.mime_type, f.size_bytes, f.upload_status,
      f.uploaded_by_user_id, f.created_at
    FROM files f
    WHERE f.order_id = ${orderId}
    ORDER BY f.created_at ASC
  `) as DbFileRow[];

  return rows.map(serializeFile);
}

export async function getFileWithOrder(fileId: string): Promise<
  DbFileRow & {
    order_number: string;
    client_id: string;
    order_status: string;
    deleted_at: string | null;
  }
> {
  const rows = await sql`
    SELECT
      f.id, f.order_id, f.order_item_id, f.block, f.storage_key,
      f.original_name, f.mime_type, f.size_bytes, f.upload_status,
      f.uploaded_by_user_id, f.created_at,
      o.order_number, o.client_id, o.status AS order_status, o.deleted_at
    FROM files f
    JOIN orders o ON o.id = f.order_id
    WHERE f.id = ${fileId}
    LIMIT 1
  `;
  const row = rows[0] as
    | (DbFileRow & {
        order_number: string;
        client_id: string;
        order_status: string;
        deleted_at: string | null;
      })
    | undefined;
  if (!row) throw new Error('file_not_found');
  return row;
}
