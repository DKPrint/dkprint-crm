import type { FileBlock } from './constants';

/** Canonical R2 key (§9.2, §20.10). */
export function buildStorageKey(params: {
  env: string;
  orderNumber: string;
  itemId: string;
  block: FileBlock;
  fileId: string;
  safeName: string;
}): string {
  const { env, orderNumber, itemId, block, fileId, safeName } = params;
  return `dkprint/${env}/orders/${orderNumber}/items/${itemId}/${block}/${fileId}-${safeName}`;
}
