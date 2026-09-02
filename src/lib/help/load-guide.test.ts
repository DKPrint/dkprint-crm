import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadGuideForRole } from './load-guide';

describe('loadGuideForRole', () => {
  it('loads admin guide from disk without query role switching', async () => {
    const guide = await loadGuideForRole('admin');
    assert.equal(guide.filename, '00-admin.md');
    assert.equal(guide.title, 'Администратор');
    assert.match(guide.markdown, /Администратор/);
  });

  it('loads courier guide only', async () => {
    const guide = await loadGuideForRole('courier');
    assert.equal(guide.filename, '04-courier.md');
    assert.match(guide.markdown, /Курьер/);
    assert.equal(guide.markdown.includes('Админка → Пользователи'), false);
  });
});
