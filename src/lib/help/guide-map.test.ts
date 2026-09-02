import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Role } from '@/lib/auth/permissions';
import { GUIDE_FILE_BY_ROLE, guideFileForRole, guideTitle } from './guide-map';

const ROLES: Role[] = ['admin', 'photo_center', 'production', 'designer', 'courier'];

describe('guide-map', () => {
  it('maps every Role to a unique guide filename', () => {
    const files = ROLES.map((r) => guideFileForRole(r));
    assert.deepEqual(files, [
      '00-admin.md',
      '01-photo-center.md',
      '02-production.md',
      '03-designer.md',
      '04-courier.md',
    ]);
    assert.equal(new Set(files).size, files.length);
  });

  it('every Role maps to an existing docs/user-guides file', () => {
    for (const role of ROLES) {
      const file = GUIDE_FILE_BY_ROLE[role];
      const path = join(process.cwd(), 'docs', 'user-guides', file);
      assert.equal(existsSync(path), true, `missing ${path}`);
    }
  });

  it('guideTitle returns RU labels', () => {
    assert.equal(guideTitle('admin'), 'Администратор');
    assert.equal(guideTitle('courier'), 'Курьер');
  });
});
