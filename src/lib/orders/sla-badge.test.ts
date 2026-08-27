import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSlaBadge } from './sla-badge';

describe('computeSlaBadge', () => {
  const started = '2026-08-01T00:00:00.000Z';

  it('running when within targetHours', () => {
    const badge = computeSlaBadge({
      slaStartedAt: started,
      slaStoppedAt: null,
      status: 'accepted',
      targetHours: 72,
      now: new Date('2026-08-02T00:00:00.000Z'), // +24h
    });
    assert.equal(badge.state, 'running');
    assert.equal(badge.elapsedHours, 24);
    assert.equal(badge.remainingHours, 48);
    assert.match(badge.label, /осталось/);
  });

  it('overdue when elapsed exceeds targetHours', () => {
    const badge = computeSlaBadge({
      slaStartedAt: started,
      slaStoppedAt: null,
      status: 'in_production',
      targetHours: 72,
      now: new Date('2026-08-05T00:00:00.000Z'), // +96h
    });
    assert.equal(badge.state, 'overdue');
    assert.equal(badge.elapsedHours, 96);
    assert.ok(badge.remainingHours !== null && badge.remainingHours < 0);
    assert.match(badge.label, /просрочен/);
  });

  it('stopped when slaStoppedAt is set', () => {
    const badge = computeSlaBadge({
      slaStartedAt: started,
      slaStoppedAt: '2026-08-02T12:00:00.000Z',
      status: 'delivered',
      targetHours: 72,
      now: new Date('2026-08-10T00:00:00.000Z'),
    });
    assert.equal(badge.state, 'stopped');
    assert.equal(badge.elapsedHours, 36);
    assert.equal(badge.remainingHours, null);
    assert.match(badge.label, /остановлен/);
  });

  it('stopped for cancelled even without stop timestamp', () => {
    const badge = computeSlaBadge({
      slaStartedAt: started,
      slaStoppedAt: null,
      status: 'cancelled',
      targetHours: 72,
      now: new Date('2026-08-10T00:00:00.000Z'),
    });
    assert.equal(badge.state, 'stopped');
  });
});
