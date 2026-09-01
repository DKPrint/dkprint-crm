import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDevTelegramAlert, sendDevTelegramAlert } from './dev-telegram';

describe('formatDevTelegramAlert', () => {
  it('bold title and escaped body lines', () => {
    const text = formatDevTelegramAlert('CI failed', ['repo & branch', 'see <link>']);
    assert.match(text, /^<b>CI failed<\/b>/);
    assert.match(text, /repo &amp; branch/);
    assert.match(text, /see &lt;link&gt;/);
  });
});

describe('sendDevTelegramAlert', () => {
  it('returns false when dev chat env is missing', async () => {
    const prevToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevChat = process.env.TELEGRAM_DEV_CHAT_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_DEV_CHAT_ID;
    try {
      assert.equal(await sendDevTelegramAlert('test'), false);
    } finally {
      if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = prevToken;
      if (prevChat === undefined) delete process.env.TELEGRAM_DEV_CHAT_ID;
      else process.env.TELEGRAM_DEV_CHAT_ID = prevChat;
    }
  });
});
