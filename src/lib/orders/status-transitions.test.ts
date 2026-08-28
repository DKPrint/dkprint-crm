import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can } from '@/lib/auth/permissions';
import {
  canTransition,
  getStatusNeighbors,
  hasCancelEdge,
  SEED_TRANSITIONS,
  type OrderStatus,
} from './status-transitions';

const allFlagsOn = {
  can_access_reports: true,
  can_edit_price: true,
  can_cancel_order: true,
  can_soft_delete_order: true,
  can_manage_sla: true,
};

describe('status-transitions', () => {
  it('allows happy forward new→accepted for production', () => {
    assert.equal(
      canTransition({ from: 'new', to: 'accepted', role: 'production' }, SEED_TRANSITIONS),
      true,
    );
  });

  it('forbids production→with_courier', () => {
    assert.equal(
      canTransition(
        {
          from: 'ready_for_pickup',
          to: 'with_courier',
          role: 'production',
        },
        SEED_TRANSITIONS,
      ),
      false,
    );
  });

  it('denies designer cancel', () => {
    assert.equal(
      canTransition({ from: 'accepted', to: 'cancelled', role: 'designer' }, SEED_TRANSITIONS),
      false,
    );
  });

  it('allows production cancel via edge', () => {
    assert.equal(
      canTransition({ from: 'accepted', to: 'cancelled', role: 'production' }, SEED_TRANSITIONS),
      true,
    );
  });

  it('allows admin jump', () => {
    assert.equal(
      canTransition(
        {
          from: 'new',
          to: 'ready_for_pickup',
          role: 'admin',
          isAdminJump: true,
        },
        SEED_TRANSITIONS,
      ),
      true,
    );
  });

  it('denies admin jump into cancelled', () => {
    assert.equal(
      canTransition(
        {
          from: 'new',
          to: 'cancelled',
          role: 'admin',
          isAdminJump: true,
        },
        SEED_TRANSITIONS,
      ),
      false,
    );
  });

  it('denies non-admin jump', () => {
    assert.equal(
      canTransition(
        {
          from: 'new',
          to: 'ready_for_pickup',
          role: 'production',
          isAdminJump: true,
        },
        SEED_TRANSITIONS,
      ),
      false,
    );
  });

  it('allows full forward chain for roles on each edge', () => {
    const chain: OrderStatus[] = [
      'new',
      'accepted',
      'at_designer',
      'in_production',
      'ready_for_pickup',
      'with_courier',
      'delivered',
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      const from = chain[i]!;
      const to = chain[i + 1]!;
      const edge = SEED_TRANSITIONS.find((e) => e.from === from && e.to === to);
      assert.ok(edge, `missing edge ${from}→${to}`);
      const role = edge.roles[0]!;
      assert.equal(
        canTransition({ from, to, role }, SEED_TRANSITIONS),
        true,
        `${from}→${to} for ${role}`,
      );
    }
  });

  it('hasCancelEdge is true for cancellable statuses, false for delivered/cancelled', () => {
    assert.equal(hasCancelEdge(SEED_TRANSITIONS, 'accepted'), true);
    assert.equal(hasCancelEdge(SEED_TRANSITIONS, 'with_courier'), true);
    assert.equal(hasCancelEdge(SEED_TRANSITIONS, 'delivered'), false);
    assert.equal(hasCancelEdge(SEED_TRANSITIONS, 'cancelled'), false);
  });

  it('photo_center cancel allowed by flag + cancel edge; designer still denied by can()', () => {
    assert.equal(hasCancelEdge(SEED_TRANSITIONS, 'accepted'), true);
    assert.equal(can('photo_center', 'cancel_order', allFlagsOn), true);
    assert.equal(can('photo_center', 'cancel_order'), false);
    assert.equal(can('designer', 'cancel_order', allFlagsOn), false);
  });
});

describe('getStatusNeighbors', () => {
  it('production at in_production has at_designer prev and ready_for_pickup next', () => {
    const n = getStatusNeighbors('in_production', 'production', SEED_TRANSITIONS);
    assert.equal(n.prev, 'at_designer');
    assert.equal(n.next, 'ready_for_pickup');
  });

  it('courier at new has no neighbors', () => {
    const n = getStatusNeighbors('new', 'courier', SEED_TRANSITIONS);
    assert.equal(n.prev, null);
    assert.equal(n.next, null);
  });

  it('production at ready_for_pickup cannot advance to with_courier', () => {
    const n = getStatusNeighbors('ready_for_pickup', 'production', SEED_TRANSITIONS);
    assert.equal(n.prev, 'in_production');
    assert.equal(n.next, null);
  });
});
