import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOrderTelegramCard,
  escapeHtml,
  isTelegramNotModifiedError,
  syncTelegramCardCore,
} from './telegram';
import type { OrderTelegramCard } from './types';

const sampleOrder: OrderTelegramCard = {
  id: '11111111-1111-1111-1111-111111111111',
  orderNumber: 'DK-260828-1',
  clientName: 'Точка А',
  status: 'accepted',
  totalAmount: '1500.00',
  telegramMessageId: 42,
  lastComment: 'Нужен макет',
  isUrgent: false,
};

describe('escapeHtml', () => {
  it('escapes special HTML chars', () => {
    assert.equal(escapeHtml('a & b <c>'), 'a &amp; b &lt;c&gt;');
  });
});

describe('buildOrderTelegramCard', () => {
  it('includes bold status and last comment', () => {
    const text = buildOrderTelegramCard(sampleOrder);
    assert.match(text, /<b>Статус: Принят в работу<\/b>/);
    assert.match(text, /Комментарий: Нужен макет/);
    assert.match(text, /DK-260828-1/);
  });

  it('shows dash when no comment', () => {
    const text = buildOrderTelegramCard({ ...sampleOrder, lastComment: null });
    assert.match(text, /Комментарий: —/);
  });

  it('adds warning flags when passed', () => {
    const text = buildOrderTelegramCard(sampleOrder, {
      problematicLayout: true,
      slaOverdue: true,
    });
    assert.match(text, /⚠️ Проблемный макет/);
    assert.match(text, /⚠️ Просрочка SLA/);
  });

  it('adds urgent line after status when isUrgent', () => {
    const text = buildOrderTelegramCard({ ...sampleOrder, isUrgent: true });
    assert.match(text, /☑️ Срочно/);
    const statusIdx = text.indexOf('Статус:');
    const urgentIdx = text.indexOf('☑️ Срочно');
    const commentIdx = text.indexOf('Комментарий:');
    assert.ok(statusIdx >= 0 && urgentIdx > statusIdx && urgentIdx < commentIdx);
  });

  it('omits urgent line when not urgent', () => {
    const text = buildOrderTelegramCard(sampleOrder);
    assert.equal(text.includes('☑️ Срочно'), false);
  });
});

describe('syncTelegramCardCore', () => {
  it('falls back to send when edit fails', async () => {
    let sendCalls = 0;
    const result = await syncTelegramCardCore(99, 'text', {
      send: async () => {
        sendCalls += 1;
        return 100;
      },
      edit: async () => {
        throw new Error('message not found');
      },
    });
    assert.equal(result.mode, 'send');
    assert.equal(result.messageId, 100);
    assert.equal(sendCalls, 1);
  });

  it('treats message-is-not-modified as successful edit', async () => {
    let sendCalls = 0;
    const result = await syncTelegramCardCore(99, 'text', {
      send: async () => {
        sendCalls += 1;
        return 100;
      },
      edit: async () => {
        throw new Error(
          'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
        );
      },
    });
    assert.equal(result.mode, 'edit');
    assert.equal(result.messageId, 99);
    assert.equal(sendCalls, 0);
  });

  it('edits when message id exists', async () => {
    let sendCalls = 0;
    let editCalls = 0;
    const result = await syncTelegramCardCore(99, 'text', {
      send: async () => {
        sendCalls += 1;
        return 100;
      },
      edit: async (id) => {
        editCalls += 1;
        assert.equal(id, 99);
      },
    });
    assert.equal(result.mode, 'edit');
    assert.equal(result.messageId, 99);
    assert.equal(sendCalls, 0);
    assert.equal(editCalls, 1);
  });
});

describe('isTelegramNotModifiedError', () => {
  it('detects telegram not-modified description', () => {
    assert.equal(
      isTelegramNotModifiedError(new Error('Bad Request: message is not modified')),
      true,
    );
    assert.equal(isTelegramNotModifiedError(new Error('message not found')), false);
  });
});
