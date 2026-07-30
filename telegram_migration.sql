-- add_account_bot orqali xodimning Telegram hisobini bog'lash uchun ustunlar.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);
