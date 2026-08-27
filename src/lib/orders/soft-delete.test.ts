import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import { verifyUserPassword } from './soft-delete';

describe('soft-delete password guard', () => {
  it('accepts correct password', async () => {
    const hash = await bcrypt.hash('secret-pass', 4);
    assert.equal(await verifyUserPassword('secret-pass', hash), true);
  });

  it('rejects wrong password', async () => {
    const hash = await bcrypt.hash('secret-pass', 4);
    assert.equal(await verifyUserPassword('wrong', hash), false);
  });
});
