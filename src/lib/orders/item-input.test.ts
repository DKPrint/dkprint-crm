import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCatalogLineUnitPrice, resolveOrderItemLine } from './item-input';

describe('order item input §4.4 / §8', () => {
  const catalogProduct = {
    id: 'prod-1',
    categoryId: 'cat-leaf',
    catalogCategoryId: 'cat-leaf',
    catalogCategoryPath: 'Полиграфия / Визитки',
    name: 'Визитки',
    unitPrice: '12.50',
  };

  it('catalog line ignores client unitPrice', () => {
    assert.equal(resolveCatalogLineUnitPrice('12.50', '999.99'), '12.50');
    assert.equal(resolveCatalogLineUnitPrice('12.50', 0), '12.50');
  });

  it('catalog line snapshots name and price from catalog_products', () => {
    const line = resolveOrderItemLine(
      {
        catalogProductId: 'prod-1',
        quantity: 2,
        unitPrice: 1,
        name: 'ignored',
        techParams: 'A4',
      },
      catalogProduct,
    );
    assert.equal(line.isManual, false);
    assert.equal(line.catalogProductId, 'prod-1');
    assert.equal(line.categoryId, null);
    assert.equal(line.catalogCategoryId, 'cat-leaf');
    assert.equal(line.catalogCategoryPath, 'Полиграфия / Визитки');
    assert.equal(line.name, 'Визитки');
    assert.equal(line.unitPrice, '12.50');
    assert.equal(line.quantity, 2);
    assert.equal(line.techParams, 'A4');
  });

  it('manual line uses client name and price without catalogProductId', () => {
    const line = resolveOrderItemLine(
      {
        isManual: true,
        name: 'Срочная доработка',
        quantity: 1,
        unitPrice: '45.00',
        techParams: null,
      },
      null,
    );
    assert.equal(line.isManual, true);
    assert.equal(line.catalogProductId, null);
    assert.equal(line.name, 'Срочная доработка');
    assert.equal(line.unitPrice, '45.00');
  });

  it('manual line rejects missing price', () => {
    assert.throws(
      () => resolveOrderItemLine({ isManual: true, name: 'X', quantity: 1 }, null),
      /validation/,
    );
  });
});
