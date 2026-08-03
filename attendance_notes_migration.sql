CREATE TABLE IF NOT EXISTS attendance_notes (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  note_type VARCHAR(20) NOT NULL,
  text TEXT,
  note_date VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_attendance_note_day UNIQUE (employee_id, note_date)
);
