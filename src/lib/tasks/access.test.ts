import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertTasksAccess, assertTaskParticipant, taskMatchesFilter } from './access';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';

function user(role: SessionUser['role'], id = 'me'): SessionUser {
  return { id, role, clientId: null };
}

describe('tasks access §12.3', () => {
  it('allows admin, production, designer, photo_center', () => {
    assert.doesNotThrow(() => assertTasksAccess(user('admin')));
    assert.doesNotThrow(() => assertTasksAccess(user('production')));
    assert.doesNotThrow(() => assertTasksAccess(user('designer')));
    assert.doesNotThrow(() => assertTasksAccess(user('photo_center')));
  });

  it('denies courier', () => {
    assert.throws(() => assertTasksAccess(user('courier')), /forbidden/);
  });

  it('filter all is assignee OR creator only (not company-wide)', () => {
    const me = 'me';
    const task = { assigneeUserId: 'other', creatorUserId: 'other2' };
    assert.equal(taskMatchesFilter('my', me, { assigneeUserId: me, creatorUserId: 'x' }), true);
    assert.equal(
      taskMatchesFilter('created', me, { assigneeUserId: 'x', creatorUserId: me }),
      true,
    );
    assert.equal(taskMatchesFilter('all', me, { assigneeUserId: me, creatorUserId: 'x' }), true);
    assert.equal(taskMatchesFilter('all', me, task), false);
  });

  it('assertTaskParticipant denies unrelated user', () => {
    assert.throws(
      () =>
        assertTaskParticipant(user('admin', 'u1'), {
          assignee_user_id: 'a',
          creator_user_id: 'b',
        }),
      /forbidden/,
    );
    assert.doesNotThrow(() =>
      assertTaskParticipant(user('admin', 'a'), {
        assignee_user_id: 'a',
        creator_user_id: 'b',
      }),
    );
  });
});
