import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from './constants';

export const presignSchema = z.object({
  orderId: z.string().uuid(),
  itemId: z.string().uuid(),
  block: z.enum(['client', 'designer']),
  filename: z.string().min(1).max(512),
  mimeType: z.string().refine((m) => ALLOWED_MIME_TYPES.has(m), 'invalid_mime'),
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES, 'file_too_large'),
});

export const confirmSchema = z.object({
  fileId: z.string().uuid(),
});
