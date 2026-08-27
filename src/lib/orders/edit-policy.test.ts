import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertCanEditOrderFields } from './edit-policy';

describe('edit-policy', () => {
  const base = {
    client_id: 'c1',
    status: 'new',
    source: 'photo_center',
    deleted_at: null,
  };

  it('admin always', () => {
    assert.doesNotThrow(() =>
      assertCanEditOrderFields({ id: 'u', role: 'admin', clientId: null }, base),
    );
  });

  it('photo_center needs reason on new own order', () => {
    assert.throws(() =>
      assertCanEditOrderFields({ id: 'u', role: 'photo_center', clientId: 'c1' }, base),
    );
    assert.doesNotThrow(() =>
      assertCanEditOrderFields({ id: 'u', role: 'photo_center', clientId: 'c1' }, base, {
        reason: 'fix typo',
      }),
    );
  });

  it('production only source=production', () => {
    assert.throws(() =>
      assertCanEditOrderFields({ id: 'u', role: 'production', clientId: null }, base),
    );
    assert.doesNotThrow(() =>
      assertCanEditOrderFields(
        { id: 'u', role: 'production', clientId: null },
        { ...base, source: 'production' },
      ),
    );
  });

  it('blocks cancelled and deleted', () => {
    assert.throws(() =>
      assertCanEditOrderFields(
        { id: 'u', role: 'admin', clientId: null },
        { ...base, status: 'cancelled' },
      ),
    );
    assert.throws(() =>
      assertCanEditOrderFields(
        { id: 'u', role: 'admin', clientId: null },
        { ...base, deleted_at: 'x' },
      ),
    );
  });
});
