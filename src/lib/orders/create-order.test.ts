import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatOrderNumber } from './order-number';

describe('create-order number allocation (pure)', () => {
  it('sequence N produces DK-YYMMDD-N', () => {
    assert.equal(formatOrderNumber('260827', 1), 'DK-260827-1');
    assert.equal(formatOrderNumber('260827', 7), 'DK-260827-7');
    // Mirrors SQL: 'DK-' || yymmdd || '-' || last_sequence::text
    const yymmdd = '260901';
    const lastSequence = 12;
    assert.equal(`DK-${yymmdd}-${lastSequence}`, formatOrderNumber(yymmdd, lastSequence));
  });
});
