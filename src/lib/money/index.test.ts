import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMoney2, lineTotal, recalcOrderTotal, sumLineTotals, toApiNumber } from './index';

describe('lib/money', () => {
  it('computes line_total with 2 decimal places', () => {
    assert.equal(formatMoney2(lineTotal(3, '10.10')), '30.30');
  });

  it('sums line totals', () => {
    const total = sumLineTotals([lineTotal(2, '1.005'), lineTotal(1, '2')]);
    // 1.005 * 2 → 2.01; + 2.00 → 4.01
    assert.equal(formatMoney2(total), '4.01');
  });

  it('recalcOrderTotal matches sum of line totals', () => {
    assert.equal(
      formatMoney2(
        recalcOrderTotal([
          { quantity: 2, unitPrice: '1.005' },
          { quantity: 1, unitPrice: '2' },
        ]),
      ),
      '4.01',
    );
  });

  it('exposes API number with 2 decimals', () => {
    assert.equal(toApiNumber(lineTotal(1, '12.5')), 12.5);
    assert.equal(formatMoney2(12.5), '12.50');
  });

  it('rejects non-positive quantity', () => {
    assert.throws(() => lineTotal(0, '1'));
  });
});
