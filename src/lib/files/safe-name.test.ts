import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeFileName } from './safe-name';

describe('safeFileName', () => {
  it('strips path traversal', () => {
    assert.equal(safeFileName('../../etc/passwd'), 'passwd');
    assert.equal(safeFileName('folder/file.pdf'), 'file.pdf');
  });

  it('replaces unsafe chars', () => {
    assert.equal(safeFileName('фото (1).jpg'), '______1_.jpg');
  });

  it('rejects empty or dot names', () => {
    assert.throws(() => safeFileName('..'), /invalid_filename/);
    assert.throws(() => safeFileName(''), /invalid_filename/);
  });
});
