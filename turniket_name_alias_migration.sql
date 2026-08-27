-- Kadr qo'lda tuzatgan xlsx-ism -> xodim mosligini eslab qolish uchun

CREATE TABLE IF NOT EXISTS turniket_name_aliases (
    id              SERIAL PRIMARY KEY,
    normalized_name VARCHAR(200) NOT NULL UNIQUE,
    employee_id     INTEGER NOT NULL REFERENCES employees(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
