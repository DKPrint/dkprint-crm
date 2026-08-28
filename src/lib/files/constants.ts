/** §9.6 limits and presign/download TTLs. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Human-readable list for UI (upload block hint / errors). */
export const ALLOWED_FORMATS_LABEL = 'JPEG, PNG, WebP, GIF, TIFF, PDF, ZIP';

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'application/pdf',
  'application/zip',
]);

/** `<input accept>` + extension fallback when browser leaves `file.type` empty. */
export const FILE_INPUT_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.pdf',
  '.zip',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'application/pdf',
  'application/zip',
].join(',');

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

/** Resolve MIME for upload; falls back to extension if `file.type` is empty/wrong. */
export function resolveUploadMimeType(file: {
  name: string;
  type: string;
}): string | null {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  const mime = EXT_TO_MIME[lower.slice(dot)];
  return mime && ALLOWED_MIME_TYPES.has(mime) ? mime : null;
}

export const PRESIGN_TTL_SECONDS = 600; // 10 min (within §9.4 5–15 min)
export const DOWNLOAD_TTL_SECONDS = 300; // 5 min (within §9.5 1–5 min)

export type FileBlock = 'client' | 'designer';
export type UploadStatus = 'pending' | 'confirmed' | 'failed';
