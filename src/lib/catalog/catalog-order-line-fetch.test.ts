import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { catalogProductFetchPatch } from './catalog-order-line-fetch';

describe('catalogProductFetchPatch', () => {
  const productId = '11111111-2222-3333-4444-555555555555';

  it('returns null when name and price already match (no parent re-render loop)', () => {
    assert.equal(
      catalogProductFetchPatch(
        productId,
        { id: productId, name: 'Визитки', unitPrice: 12.5 },
        { catalogProductId: productId, name: 'Визитки', unitPrice: '12.50' },
      ),
      null,
    );
  });

  it('returns patch when price differs', () => {
    assert.deepEqual(
      catalogProductFetchPatch(
        productId,
        { id: productId, name: 'Визитки', unitPrice: 15 },
        { catalogProductId: productId, name: 'Визитки', unitPrice: '12.50' },
      ),
      { name: 'Визитки', unitPrice: '15.00' },
    );
  });

  it('returns null for stale fetch (product changed)', () => {
    assert.equal(
      catalogProductFetchPatch(
        productId,
        { id: productId, name: 'Old', unitPrice: 10 },
        { catalogProductId: 'other-id', name: 'New line', unitPrice: '0.00' },
      ),
      null,
    );
  });
});
