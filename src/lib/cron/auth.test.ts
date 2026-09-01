import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCronRequest } from './auth';

describe('authorizeCronRequest §11.2', () => {
  const prev = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it('rejects missing Authorization', () => {
    const req = new Request('http://localhost/api/cron/sla-overdue');
    assert.equal(authorizeCronRequest(req), false);
  });

  it('rejects wrong token', () => {
    const req = new Request('http://localhost/api/cron/sla-overdue', {
      headers: { Authorization: 'Bearer wrong' },
    });
    assert.equal(authorizeCronRequest(req), false);
  });

  it('accepts matching Bearer token', () => {
    const req = new Request('http://localhost/api/cron/sla-overdue', {
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(authorizeCronRequest(req), true);
  });

  it('rejects when CRON_SECRET env is unset', () => {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost/api/cron/sla-overdue', {
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(authorizeCronRequest(req), false);
  });
});
