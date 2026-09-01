import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveItemCategoryName } from './queries';

describe('resolveItemCategoryName', () => {
  it('prefers catalog_category_path snapshot', () => {
    assert.equal(
      resolveItemCategoryName({
        catalog_category_path: 'Полиграфия / Визитки',
        category_name: 'ignored',
      }),
      'Полиграфия / Визитки',
    );
  });

  it('falls back to joined category_name', () => {
    assert.equal(
      resolveItemCategoryName({ catalog_category_path: null, category_name: 'Legacy cat' }),
      'Legacy cat',
    );
  });

  it('returns null when both missing', () => {
    assert.equal(resolveItemCategoryName({}), null);
  });
});
