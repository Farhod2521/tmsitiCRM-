-- 1. Employee status
CREATE TYPE employee_status_enum AS ENUM ('faol','otpuska','dekret');
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status employee_status_enum NOT NULL DEFAULT 'faol';

-- 2. bolim_ball -> float
ALTER TABLE scores ALTER COLUMN bolim_ball TYPE DOUBLE PRECISION;

-- 3. Weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  file_name VARCHAR(255),
  file_b64 TEXT,
  uploaded_at TIMESTAMP,
  ball DOUBLE PRECISION,
  confirmed_at TIMESTAMP,
  confirmed_by INTEGER REFERENCES employees(id),
  CONSTRAINT uq_weekly_report UNIQUE (employee_id, year, month, week)
);

-- 4. Ijro documents
CREATE TYPE ijro_doc_tur_enum AS ENUM ('kiruvchi','chiquvchi','ichki');
CREATE TYPE ijro_doc_manba_enum AS ENUM ('pq_pf','vm','qv','direktor');
CREATE TYPE ijro_doc_holati_enum AS ENUM ('jarayonda','bajarildi','muddati_yaqin','kechikmoqda','bolimga_yonaltirildi');
CREATE TYPE ijro_doc_davriyligi_enum AS ENUM ('bir_martalik','har_chorakda','har_yili');

CREATE TABLE IF NOT EXISTS ijro_documents (
  id SERIAL PRIMARY KEY,
  tur ijro_doc_tur_enum NOT NULL DEFAULT 'kiruvchi',
  manba ijro_doc_manba_enum NOT NULL,
  hujjat_raqami VARCHAR(100),
  hujjat_sanasi VARCHAR(20),
  sarlavha VARCHAR(500),
  mazmun TEXT,
  masul_orinbosar_id INTEGER REFERENCES employees(id),
  masul_bolimlar VARCHAR(500),
  ijro_muddati TIMESTAMP,
  davriyligi ijro_doc_davriyligi_enum NOT NULL DEFAULT 'bir_martalik',
  kelishuvchi_tashkilotlar VARCHAR(500),
  fayl_name VARCHAR(255),
  fayl_b64 TEXT,
  holati ijro_doc_holati_enum NOT NULL DEFAULT 'jarayonda',
  qayta_sabab TEXT,
  created_by INTEGER REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Ijro doc bolimlar (bo'limlarga yo'naltirish va holat)
CREATE TYPE ijro_doc_bolim_holati_enum AS ENUM ('yuborildi','qabul_qilindi','rad_etildi','bajarilmoqda','bajarildi');

CREATE TABLE IF NOT EXISTS ijro_doc_bolimlar (
  id          SERIAL PRIMARY KEY,
  doc_id      INTEGER NOT NULL REFERENCES ijro_documents(id) ON DELETE CASCADE,
  bolim_id    INTEGER NOT NULL REFERENCES departments(id),
  holati      ijro_doc_bolim_holati_enum NOT NULL DEFAULT 'yuborildi',
  izoh        TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  qaror_at    TIMESTAMP,
  qaror_by    INTEGER REFERENCES employees(id),
  CONSTRAINT uq_doc_bolim UNIQUE (doc_id, bolim_id)
);

-- 6. Backfill: mavjud ijro_documents lar uchun ijro_doc_bolimlar yaratish
--    (yangi kod deploydan oldin yaratilgan hujjatlar uchun)
INSERT INTO ijro_doc_bolimlar (doc_id, bolim_id, holati, assigned_at)
SELECT
    d.id,
    (elem.val #>> '{}')::integer,
    'yuborildi',
    COALESCE(d.created_at, NOW())
FROM ijro_documents d
CROSS JOIN LATERAL json_array_elements(d.masul_bolimlar::json) AS elem(val)
WHERE d.masul_bolimlar IS NOT NULL
  AND d.masul_bolimlar != ''
  AND d.masul_bolimlar != '[]'
  AND d.masul_bolimlar != 'null'
ON CONFLICT (doc_id, bolim_id) DO NOTHING;
