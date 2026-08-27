-- Turniket davomat (xlsx import) uchun yangi jadvallar

CREATE TABLE IF NOT EXISTS turniket_attendances (
    id             SERIAL PRIMARY KEY,
    employee_id    INTEGER NOT NULL REFERENCES employees(id),
    date           VARCHAR(10) NOT NULL,
    check_in       VARCHAR(5),
    check_out      VARCHAR(5),
    worked_minutes INTEGER,
    created_at     TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_turniket_day UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS ix_turniket_attendances_employee_id ON turniket_attendances (employee_id);
CREATE INDEX IF NOT EXISTS ix_turniket_attendances_date ON turniket_attendances (date);

CREATE TABLE IF NOT EXISTS turniket_import_batches (
    id           VARCHAR(36) PRIMARY KEY,
    year         INTEGER NOT NULL,
    month        INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    uploaded_by  INTEGER NOT NULL REFERENCES employees(id),
    created_at   TIMESTAMP DEFAULT NOW()
);
