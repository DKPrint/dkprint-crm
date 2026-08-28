/** Collapse whitespace and truncate tech params for compact displays (TG, workshop). */
export function shortTech(tech: string | null | undefined, max = 80): string {
  const t = (tech ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '—';
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
