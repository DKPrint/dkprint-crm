/**
 * Minimal Markdown → HTML for user guides (no deps).
 * Supports: h1–h3, paragraphs, ul/ol, bold, inline code, hr, GFM-ish tables.
 * Raw HTML in source is escaped (no script injection).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline formatting after HTML-escape. */
export function formatInlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes('|')) return false;
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(t) && /-/.test(t);
}

function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function renderTable(headerLine: string, bodyLines: string[]): string {
  const headers = splitTableRow(headerLine);
  const thead = `<thead><tr>${headers
    .map((h) => `<th>${formatInlineMarkdown(h)}</th>`)
    .join('')}</tr></thead>`;
  const tbody = `<tbody>${bodyLines
    .map((line) => {
      const cells = splitTableRow(line);
      while (cells.length < headers.length) cells.push('');
      return `<tr>${cells
        .slice(0, headers.length)
        .map((c) => `<td>${formatInlineMarkdown(c)}</td>`)
        .join('')}</tr>`;
    })
    .join('')}</tbody>`;
  return `<div class="table-wrap"><table class="data help-table">${thead}${tbody}</table></div>`;
}

/** Convert guide markdown to safe HTML fragment. */
export function markdownToSafeHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const parts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      parts.push('<hr />');
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]!)) {
      const header = trimmed;
      i += 2;
      const body: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        body.push(lines[i]!.trim());
        i += 1;
      }
      parts.push(renderTable(header, body));
      continue;
    }

    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h) {
      const level = h[1]!.length;
      parts.push(`<h${level}>${formatInlineMarkdown(h[2]!)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!.trim())) {
        items.push(formatInlineMarkdown(lines[i]!.trim().replace(/^[-*]\s+/, '')));
        i += 1;
      }
      parts.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(formatInlineMarkdown(lines[i]!.trim().replace(/^\d+\.\s+/, '')));
        i += 1;
      }
      parts.push(`<ol>${items.map((item) => `<li>${item}</li>`).join('')}</ol>`);
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!.trim();
      if (
        next === '' ||
        next === '---' ||
        /^#{1,3}\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        next.startsWith('|')
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    parts.push(`<p>${formatInlineMarkdown(para.join(' '))}</p>`);
  }

  return parts.join('\n');
}
