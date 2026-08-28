-- v1.4 Telegram live order card (TZ §10.3)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT NULL;
