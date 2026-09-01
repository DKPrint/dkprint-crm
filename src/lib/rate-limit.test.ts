import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, resetRateLimitStoreForTests } from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it('allows requests under max within window', () => {
    const opts = { max: 3, windowMs: 60_000 };
    assert.deepEqual(checkRateLimit('k', opts), { ok: true });
    assert.deepEqual(checkRateLimit('k', opts), { ok: true });
    assert.deepEqual(checkRateLimit('k', opts), { ok: true });
  });

  it('blocks when max exceeded and returns retryAfterSec', () => {
    const opts = { max: 2, windowMs: 10_000 };
    checkRateLimit('k', opts);
    checkRateLimit('k', opts);
    const blocked = checkRateLimit('k', opts);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(blocked.retryAfterSec >= 1);
      assert.ok(blocked.retryAfterSec <= 10);
    }
  });

  it('tracks keys independently', () => {
    const opts = { max: 1, windowMs: 60_000 };
    assert.deepEqual(checkRateLimit('a', opts), { ok: true });
    assert.deepEqual(checkRateLimit('b', opts), { ok: true });
    assert.equal(checkRateLimit('a', opts).ok, false);
    assert.equal(checkRateLimit('b', opts).ok, false);
  });

  it('resets after window expires', () => {
    const opts = { max: 1, windowMs: 50 };
    checkRateLimit('k', opts);
    assert.equal(checkRateLimit('k', opts).ok, false);
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        try {
          assert.deepEqual(checkRateLimit('k', opts), { ok: true });
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 60);
    });
  });
});
