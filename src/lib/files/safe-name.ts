/** Basename without path traversal; limited charset (§9.2). */
export function safeFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, '').replace(/\0/g, '');
  if (!base || base === '.' || base === '..') {
    throw new Error('invalid_filename');
  }
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  if (!safe) throw new Error('invalid_filename');
  return safe;
}
