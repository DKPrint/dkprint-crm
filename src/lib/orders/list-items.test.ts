import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupItemsByOrderId } from './list-items';

describe('order list items batch', () => {
  it('groups items by order_id preserving position order', () => {
    const map = groupItemsByOrderId([
      {
        order_id: 'o1',
        position_number: 1,
        name: 'Визитки',
        quantity: 100,
        tech_params: '4+4',
        has_layout: true,
      },
      {
        order_id: 'o2',
        position_number: 1,
        name: 'Баннер',
        quantity: 1,
        tech_params: null,
        has_layout: false,
      },
      {
        order_id: 'o1',
        position_number: 2,
        name: 'Листовка',
        quantity: 50,
        tech_params: 'A4',
        has_layout: false,
      },
    ]);

    assert.equal(map.size, 2);
    const o1 = map.get('o1');
    assert.ok(o1);
    assert.equal(o1!.length, 2);
    assert.equal(o1![0].name, 'Визитки');
    assert.equal(o1![0].hasLayout, true);
    assert.equal(o1![1].positionNumber, 2);
    assert.equal(map.get('o2')![0].hasLayout, false);
  });

  it('returns empty map for no rows', () => {
    assert.equal(groupItemsByOrderId([]).size, 0);
  });
});
