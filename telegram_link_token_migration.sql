-- add_account_bot uchun bir martalik, tez muddati tugaydigan bog'lash tokenlari.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_telegram_link_tokens_token ON telegram_link_tokens (token);
