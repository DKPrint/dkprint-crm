import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { indexImportedProduct } from './import-export';
import { resolveProductImport } from './import-rules';

type DbProduct = {
  id: string;
  category_id: string;
  name: string;
  external_code: string | null;
  unit_price: string;
};

describe('import product index (duplicate row + replacePrices)', () => {
  it('second row with same product_code finds real id and can update price', () => {
    const byId = new Map<string, DbProduct>();
    const byCode = new Map<string, DbProduct>();
    const id = '11111111-2222-3333-4444-555555555555';
    const created: DbProduct = {
      id,
      category_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'Визитки',
      external_code: 'SKU-1',
      unit_price: '10.00',
    };

    indexImportedProduct(created, 'SKU-1', byCode, byId);

    const existing = byCode.get('SKU-1');
    assert.ok(existing);
    assert.equal(existing.id, id);

    const action = resolveProductImport({ unitPrice: '10.00' }, '15.00', true);
    assert.equal(action, 'update_price');
    assert.notEqual(existing.id, '');
  });

  it('crm:{uuid} key indexes by id for round-trip re-import', () => {
    const byId = new Map<string, DbProduct>();
    const byCode = new Map<string, DbProduct>();
    const id = '22222222-3333-4444-5555-666666666666';
    const created: DbProduct = {
      id,
      category_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'Без SKU',
      external_code: null,
      unit_price: '5.00',
    };
    const key = `crm:${id}`;

    indexImportedProduct(created, key, byCode, byId);

    assert.equal(byId.get(id)?.id, id);
    assert.equal(byCode.get(key)?.id, id);
    assert.equal(resolveProductImport({ unitPrice: '5.00' }, '7.50', true), 'update_price');
  });
});
