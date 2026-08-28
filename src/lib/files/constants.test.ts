import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALLOWED_MIME_TYPES, resolveUploadMimeType } from './constants';

describe('resolveUploadMimeType', () => {
  it('accepts known MIME from file.type', () => {
    assert.equal(resolveUploadMimeType({ name: 'a.webp', type: 'image/webp' }), 'image/webp');
    assert.equal(resolveUploadMimeType({ name: 'a.gif', type: 'image/gif' }), 'image/gif');
    assert.equal(resolveUploadMimeType({ name: 'a.tiff', type: 'image/tiff' }), 'image/tiff');
  });

  it('falls back to extension when type is empty', () => {
    assert.equal(resolveUploadMimeType({ name: 'scan.TIF', type: '' }), 'image/tiff');
    assert.equal(resolveUploadMimeType({ name: 'pic.webp', type: '' }), 'image/webp');
  });

  it('rejects unknown types', () => {
    assert.equal(resolveUploadMimeType({ name: 'x.docx', type: '' }), null);
    assert.equal(
      resolveUploadMimeType({ name: 'x.png', type: 'application/octet-stream' }),
      'image/png',
    );
  });

  it('includes minimum MIME set', () => {
    for (const mime of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/tiff',
      'application/pdf',
      'application/zip',
    ]) {
      assert.equal(ALLOWED_MIME_TYPES.has(mime), true);
    }
  });
});
