import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bumpImportCounts, resolveCategoryImport, resolveProductImport } from './import-rules';

describe('catalog import rules §13.1', () => {
  describe('resolveCategoryImport', () => {
    it('skips when external_code already exists', () => {
      assert.equal(resolveCategoryImport('uuid-1'), 'skip');
    });

    it('creates when no match', () => {
      assert.equal(resolveCategoryImport(null), 'create');
    });
  });

  describe('resolveProductImport', () => {
    it('creates when product_code not in DB', () => {
      assert.equal(resolveProductImport(null, '10.00', false), 'create');
      assert.equal(resolveProductImport(null, '10.00', true), 'create');
    });

    it('skips existing product when replacePrices is false', () => {
      assert.equal(resolveProductImport({ unitPrice: '12.50' }, '99.00', false), 'skip');
    });

    it('skips when replacePrices true but price unchanged', () => {
      assert.equal(resolveProductImport({ unitPrice: '12.50' }, '12.50', true), 'skip');
      assert.equal(resolveProductImport({ unitPrice: '12.5' }, '12.50', true), 'skip');
    });

    it('updates price only when replacePrices and price differs', () => {
      assert.equal(resolveProductImport({ unitPrice: '12.50' }, '15.00', true), 'update_price');
    });
  });

  describe('bumpImportCounts', () => {
    it('counts create/skip/update_price and new categories', () => {
      let counts = { createdCount: 0, updatedPriceCount: 0, skippedCount: 0 };
      counts = bumpImportCounts(counts, 'create', true, false);
      assert.deepEqual(counts, { createdCount: 2, updatedPriceCount: 0, skippedCount: 0 });

      counts = bumpImportCounts(counts, 'skip', false, false);
      assert.deepEqual(counts, { createdCount: 2, updatedPriceCount: 0, skippedCount: 1 });

      counts = bumpImportCounts(counts, 'update_price', false, true);
      assert.deepEqual(counts, { createdCount: 3, updatedPriceCount: 1, skippedCount: 1 });
    });
  });
});
