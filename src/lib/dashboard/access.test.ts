import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyPermissionFlags } from '@/lib/auth/permissions';
import {
  canSeeDashboardKpi,
  canSeeSlaMetrics,
  canSeeTasksMetrics,
  canSeeWorkshopMetrics,
  courierDeliveryEmphasis,
} from './access';

const withReports = { ...emptyPermissionFlags, can_access_reports: true };

describe('dashboard access', () => {
  it('KPI: admin always; production/designer with flag; never photo_center/courier', () => {
    assert.equal(canSeeDashboardKpi('admin', emptyPermissionFlags), true);
    assert.equal(canSeeDashboardKpi('production', emptyPermissionFlags), false);
    assert.equal(canSeeDashboardKpi('production', withReports), true);
    assert.equal(canSeeDashboardKpi('designer', withReports), true);
    assert.equal(canSeeDashboardKpi('photo_center', withReports), false);
    assert.equal(canSeeDashboardKpi('courier', withReports), false);
  });

  it('workshop and SLA metrics for admin, production, designer only', () => {
    for (const role of ['admin', 'production', 'designer'] as const) {
      assert.equal(canSeeWorkshopMetrics(role), true);
      assert.equal(canSeeSlaMetrics(role), true);
    }
    assert.equal(canSeeWorkshopMetrics('photo_center'), false);
    assert.equal(canSeeWorkshopMetrics('courier'), false);
  });

  it('tasks metrics for all roles except courier', () => {
    assert.equal(canSeeTasksMetrics('courier'), false);
    assert.equal(canSeeTasksMetrics('photo_center'), true);
    assert.equal(canSeeTasksMetrics('admin'), true);
  });

  it('courier delivery emphasis flag', () => {
    assert.equal(courierDeliveryEmphasis('courier'), true);
    assert.equal(courierDeliveryEmphasis('admin'), false);
  });
});
