import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ratePct } from './math';

describe('report math', () => {
  it('ratePct returns 0 when total is 0', () => {
    assert.equal(ratePct(0, 0), 0);
    assert.equal(ratePct(5, 0), 0);
  });

  it('ratePct computes percent with 2 decimals', () => {
    assert.equal(ratePct(1, 3), 33.33);
    assert.equal(ratePct(1, 2), 50);
  });
});
