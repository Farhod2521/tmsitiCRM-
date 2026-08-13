ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS zamdirektor_by INTEGER REFERENCES employees(id);
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS zamdirektor_at TIMESTAMP;
