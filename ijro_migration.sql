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
