import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyPermissionFlags } from './permissions';
import type { Role } from './permissions';
import { canAccessHref, navItemsFor } from './nav';

const noReports = emptyPermissionFlags;
const withReports = { ...emptyPermissionFlags, can_access_reports: true };

function hrefs(role: Role, flags = noReports) {
  return navItemsFor(role, flags).map((i) => i.href);
}

describe('navItemsFor', () => {
  it('admin sees all items including reports and admin', () => {
    assert.deepEqual(hrefs('admin'), [
      '/dashboard',
      '/orders',
      '/orders/new',
      '/workshop',
      '/tasks',
      '/clients',
      '/reports',
      '/help',
      '/admin/catalog',
      '/admin/users',
    ]);
  });

  it('production without reports flag', () => {
    assert.deepEqual(hrefs('production'), [
      '/dashboard',
      '/orders',
      '/orders/new',
      '/workshop',
      '/tasks',
      '/clients',
      '/help',
    ]);
  });

  it('production with can_access_reports sees reports', () => {
    assert.deepEqual(hrefs('production', withReports), [
      '/dashboard',
      '/orders',
      '/orders/new',
      '/workshop',
      '/tasks',
      '/clients',
      '/reports',
      '/help',
    ]);
  });

  it('designer without reports flag', () => {
    assert.deepEqual(hrefs('designer'), [
      '/dashboard',
      '/orders',
      '/workshop',
      '/tasks',
      '/clients',
      '/help',
    ]);
  });

  it('designer with can_access_reports sees reports', () => {
    assert.deepEqual(hrefs('designer', withReports), [
      '/dashboard',
      '/orders',
      '/workshop',
      '/tasks',
      '/clients',
      '/reports',
      '/help',
    ]);
  });

  it('photo_center never sees reports even with flag', () => {
    assert.deepEqual(hrefs('photo_center', withReports), [
      '/dashboard',
      '/orders',
      '/orders/new',
      '/tasks',
      '/help',
    ]);
  });

  it('courier only sees orders', () => {
    assert.deepEqual(hrefs('courier', withReports), ['/dashboard', '/orders', '/help']);
  });

  it('all five roles have /help', () => {
    for (const role of ['admin', 'production', 'designer', 'photo_center', 'courier'] as const) {
      assert.ok(hrefs(role).includes('/help'));
    }
  });
});

describe('canAccessHref', () => {
  it('all roles can access /dashboard', () => {
    for (const role of ['admin', 'production', 'designer', 'photo_center', 'courier'] as const) {
      assert.equal(canAccessHref(role, noReports, '/dashboard'), true);
    }
  });

  it('all roles can access /help', () => {
    for (const role of ['admin', 'production', 'designer', 'photo_center', 'courier'] as const) {
      assert.equal(canAccessHref(role, noReports, '/help'), true);
    }
  });

  it('admin can access admin sub-routes', () => {
    assert.equal(canAccessHref('admin', noReports, '/admin/users'), true);
    assert.equal(canAccessHref('admin', noReports, '/admin/sla'), true);
  });

  it('non-admin cannot access admin', () => {
    assert.equal(canAccessHref('production', noReports, '/admin/users'), false);
  });

  it('photo_center cannot access reports with flag', () => {
    assert.equal(canAccessHref('photo_center', withReports, '/reports'), false);
  });

  it('allows nested paths under allowed section', () => {
    assert.equal(canAccessHref('admin', noReports, '/orders/abc'), true);
    assert.equal(canAccessHref('courier', noReports, '/orders/abc'), true);
    assert.equal(canAccessHref('production', noReports, '/tasks/new'), true);
  });

  it('courier cannot open /orders/new (separate nav right)', () => {
    assert.equal(canAccessHref('courier', noReports, '/orders/new'), false);
    assert.equal(canAccessHref('photo_center', noReports, '/orders/new'), true);
  });

  it('designer cannot open /orders/new', () => {
    assert.equal(canAccessHref('designer', noReports, '/orders/new'), false);
  });
});
