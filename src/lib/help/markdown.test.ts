import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatInlineMarkdown, markdownToSafeHtml } from './markdown';

describe('markdownToSafeHtml', () => {
  it('escapes raw HTML / script', () => {
    const html = markdownToSafeHtml('<script>alert(1)</script>\n\nHello');
    assert.equal(html.includes('<script>'), false);
    assert.equal(html.includes('&lt;script&gt;'), true);
  });

  it('renders headings lists bold hr', () => {
    const md = `# Title\n\n## Sub\n\n- one\n- two\n\n**bold** text\n\n---\n\n1. a\n2. b`;
    const html = markdownToSafeHtml(md);
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /<h2>Sub<\/h2>/);
    assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<hr \/>/);
    assert.match(html, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  });

  it('renders GFM-ish tables', () => {
    const md = `| Роль | Видит |\n|------|-------|\n| **Курьер** | Выдача |\n| Админ | Все |`;
    const html = markdownToSafeHtml(md);
    assert.match(html, /<table/);
    assert.match(html, /<th>Роль<\/th>/);
    assert.match(html, /<strong>Курьер<\/strong>/);
    assert.match(html, /<td>Выдача<\/td>/);
  });
});

describe('formatInlineMarkdown', () => {
  it('escapes then applies bold', () => {
    assert.equal(formatInlineMarkdown('<b>x</b> **y**'), '&lt;b&gt;x&lt;/b&gt; <strong>y</strong>');
  });
});
