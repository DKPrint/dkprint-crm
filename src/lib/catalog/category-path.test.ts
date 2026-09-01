import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCatalogCategoryPath } from './category-path';

describe('formatCatalogCategoryPath', () => {
  it('joins parent and leaf', () => {
    assert.equal(formatCatalogCategoryPath('Визитки', 'Полиграфия'), 'Полиграфия / Визитки');
  });

  it('returns leaf only when no parent', () => {
    assert.equal(formatCatalogCategoryPath('Баннеры', null), 'Баннеры');
  });
});
