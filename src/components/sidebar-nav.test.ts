import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isNavItemActive } from './nav-active';

describe('sidebar nav active', () => {
  it('/admin/users/uuid → Админка active, Каталог нет', () => {
    const pathname = '/admin/users/550e8400-e29b-41d4-a716-446655440000';
    assert.equal(isNavItemActive(pathname, '/admin/users'), true);
    assert.equal(isNavItemActive(pathname, '/admin/catalog'), false);
  });

  it('/admin/catalog → Каталог active', () => {
    const pathname = '/admin/catalog';
    assert.equal(isNavItemActive(pathname, '/admin/catalog'), true);
    assert.equal(isNavItemActive(pathname, '/admin/users'), false);
  });

  it('/orders/uuid → Заказы active, Новый заказ нет', () => {
    const pathname = '/orders/550e8400-e29b-41d4-a716-446655440000';
    assert.equal(isNavItemActive(pathname, '/orders'), true);
    assert.equal(isNavItemActive(pathname, '/orders/new'), false);
  });

  it('/orders/new → Новый заказ active', () => {
    const pathname = '/orders/new';
    assert.equal(isNavItemActive(pathname, '/orders/new'), true);
    assert.equal(isNavItemActive(pathname, '/orders'), false);
  });

  it('/admin/sla → Админка active (users nav item)', () => {
    const pathname = '/admin/sla';
    assert.equal(isNavItemActive(pathname, '/admin/users'), true);
    assert.equal(isNavItemActive(pathname, '/admin/catalog'), false);
  });

  it('/admin → Админка active', () => {
    assert.equal(isNavItemActive('/admin', '/admin/users'), true);
  });
});
