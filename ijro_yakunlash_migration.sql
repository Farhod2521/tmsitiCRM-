ALTER TABLE ijro_doc_bolimlar ADD COLUMN IF NOT EXISTS yakunlash_izohi TEXT;
ALTER TABLE ijro_doc_bolimlar ADD COLUMN IF NOT EXISTS yakunlash_fayllar TEXT;
ALTER TABLE ijro_doc_bolimlar ADD COLUMN IF NOT EXISTS yakunlangan_at TIMESTAMP;
ALTER TABLE ijro_doc_bolimlar ADD COLUMN IF NOT EXISTS yakunlagan_by INTEGER REFERENCES employees(id);
