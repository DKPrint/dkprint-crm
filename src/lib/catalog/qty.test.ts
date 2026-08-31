import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatQty4, toQtyNumber } from './qty';

describe('catalog BOM qty §14.21', () => {
  it('formats to 4 decimal places', () => {
    assert.equal(formatQty4(1), '1.0000');
    assert.equal(formatQty4('0.5'), '0.5000');
    assert.equal(formatQty4('1.23456'), '1.2346');
  });

  it('rejects zero and negative', () => {
    assert.throws(() => formatQty4(0), /validation/);
    assert.throws(() => formatQty4(-1), /validation/);
  });

  it('rejects values that round to zero', () => {
    assert.throws(() => formatQty4('0.00001'), /validation/);
    assert.throws(() => formatQty4(1e-7), /validation/);
  });

  it('rejects overflow past NUMERIC(12,4)', () => {
    assert.throws(() => formatQty4('100000000'), /validation/);
  });

  it('accepts max NUMERIC(12,4)', () => {
    assert.equal(formatQty4('99999999.9999'), '99999999.9999');
  });

  it('toQtyNumber returns finite number', () => {
    assert.equal(toQtyNumber('2.5'), 2.5);
  });
});
