import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'body_required'),
  isProblematicLayout: z.boolean().optional().default(false),
});
