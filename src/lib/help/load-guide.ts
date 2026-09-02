import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Role } from '@/lib/auth/permissions';
import { guideFileForRole, guideTitle } from './guide-map';

export type LoadedGuide = {
  title: string;
  markdown: string;
  filename: string;
};

/**
 * Load role guide markdown.
 * SoT: `docs/user-guides/*.md`. Deploy mirror: `src/content/user-guides/`
 * (bundled with the app; Vercel tracing also includes docs via next.config).
 * Always pick file from session role — never from client query.
 */
export async function loadGuideForRole(role: Role): Promise<LoadedGuide> {
  const filename = guideFileForRole(role);
  const candidates = [
    join(process.cwd(), 'docs', 'user-guides', filename),
    join(process.cwd(), 'src', 'content', 'user-guides', filename),
  ];

  let lastErr: unknown;
  for (const path of candidates) {
    try {
      const markdown = await readFile(path, 'utf8');
      return {
        title: guideTitle(role),
        markdown,
        filename,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('[help] guide not found', { role, filename, lastErr });
  throw new Error('not_found');
}
