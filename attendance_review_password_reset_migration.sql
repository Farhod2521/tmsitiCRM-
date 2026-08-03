ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'kutilmoqda';
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES employees(id);
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  code VARCHAR(5) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
