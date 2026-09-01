import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportableProductCode, parseCrmProductCode, resolveLeafCategoryId } from './leaf-and-code';

describe('resolveLeafCategoryId', () => {
  it('uses subcategory when set', () => {
    assert.equal(
      resolveLeafCategoryId({
        rootCategoryId: 'root',
        subcategoryId: 'sub',
        rootHasChildren: true,
      }),
      'sub',
    );
  });

  it('does not fall back to root while hasChildren or metadata unknown', () => {
    assert.equal(
      resolveLeafCategoryId({
        rootCategoryId: 'root',
        subcategoryId: '',
        rootHasChildren: true,
      }),
      '',
    );
    assert.equal(
      resolveLeafCategoryId({
        rootCategoryId: 'root',
        subcategoryId: '',
        rootHasChildren: undefined,
      }),
      '',
    );
  });

  it('uses root only when it is a true leaf', () => {
    assert.equal(
      resolveLeafCategoryId({
        rootCategoryId: 'root',
        subcategoryId: '',
        rootHasChildren: false,
      }),
      'root',
    );
  });
});

describe('exportableProductCode', () => {
  it('prefers external_code', () => {
    assert.equal(exportableProductCode('SKU-1', 'uuid-1'), 'SKU-1');
  });

  it('uses stable crm:{id} when external_code missing', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    assert.equal(exportableProductCode(null, id), `crm:${id}`);
    assert.equal(exportableProductCode('  ', id), `crm:${id}`);
  });

  it('parseCrmProductCode round-trips', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    assert.equal(parseCrmProductCode(`crm:${id}`), id);
    assert.equal(parseCrmProductCode('SKU-1'), null);
    assert.equal(parseCrmProductCode('crm:not-a-uuid'), null);
  });
});
