-- Xodimlarga biriktiriladigan fayllar (buyruqlar) — Kadrlar bo'limi va superadmin
-- Xodimlar sahifasidagi "Fayllar" oynasi uchun.

CREATE TABLE IF NOT EXISTS employee_files (
    id               SERIAL PRIMARY KEY,
    employee_id      INTEGER NOT NULL REFERENCES employees(id),
    file_name        VARCHAR(300) NOT NULL,
    file_b64         TEXT NOT NULL,
    note             VARCHAR(500),
    uploaded_by_id   INTEGER REFERENCES employees(id),
    uploaded_by_nomi VARCHAR(200),
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_employee_files_employee_id ON employee_files(employee_id);
