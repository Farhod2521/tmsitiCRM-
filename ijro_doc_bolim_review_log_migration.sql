-- IJRO nazorati bo'lim yakunlagan hisobotga bergan har bir qarori (tasdiqlash/rad
-- etish) tarixi — bir necha marta rad etilsa ham barcha izohlar saqlanib boradi.
CREATE TABLE IF NOT EXISTS ijro_doc_bolim_review_log (
    id                SERIAL PRIMARY KEY,
    doc_bolim_id      INTEGER NOT NULL REFERENCES ijro_doc_bolimlar(id) ON DELETE CASCADE,
    qaror             VARCHAR(20) NOT NULL,
    izoh              TEXT,
    reviewed_by       INTEGER REFERENCES employees(id),
    reviewed_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ijro_doc_bolim_review_log_doc_bolim_id ON ijro_doc_bolim_review_log(doc_bolim_id);
