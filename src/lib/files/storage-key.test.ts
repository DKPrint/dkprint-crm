import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStorageKey } from './storage-key';

describe('buildStorageKey §9.2', () => {
  it('uses canonical format with orderNumber', () => {
    const key = buildStorageKey({
      env: 'staging',
      orderNumber: 'DK-260827-1',
      itemId: '11111111-1111-1111-1111-111111111111',
      block: 'client',
      fileId: '22222222-2222-2222-2222-222222222222',
      safeName: 'layout.pdf',
    });
    assert.equal(
      key,
      'dkprint/staging/orders/DK-260827-1/items/11111111-1111-1111-1111-111111111111/client/22222222-2222-2222-2222-222222222222-layout.pdf',
    );
  });
});
