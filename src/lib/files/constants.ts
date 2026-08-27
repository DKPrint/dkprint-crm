/** §9.6 limits and presign/download TTLs. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/zip',
]);

export const PRESIGN_TTL_SECONDS = 600; // 10 min (within §9.4 5–15 min)
export const DOWNLOAD_TTL_SECONDS = 300; // 5 min (within §9.5 1–5 min)

export type FileBlock = 'client' | 'designer';
export type UploadStatus = 'pending' | 'confirmed' | 'failed';
