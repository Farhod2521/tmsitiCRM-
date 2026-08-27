-- Ichki hujjatlar oqimi: Xodim -> Bo'lim boshlig'i -> Zamdirektor -> Ijro (faqat ko'radi)
CREATE TABLE IF NOT EXISTS internal_documents (
    id              SERIAL PRIMARY KEY,
    hujjat_raqami   VARCHAR(50) UNIQUE NOT NULL,
    nomi            VARCHAR(300) NOT NULL,
    mazmun          TEXT,
    fayl_name       VARCHAR(255),
    fayl_b64        TEXT,
    department_id   INTEGER NOT NULL REFERENCES departments(id),
    zamdirektor_id  INTEGER REFERENCES employees(id),
    status          VARCHAR(30) NOT NULL DEFAULT 'yuborildi',
    rad_sababi      TEXT,
    parent_doc_id   INTEGER REFERENCES internal_documents(id),
    created_by      INTEGER NOT NULL REFERENCES employees(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_internal_documents_department_id  ON internal_documents(department_id);
CREATE INDEX IF NOT EXISTS ix_internal_documents_zamdirektor_id ON internal_documents(zamdirektor_id);
CREATE INDEX IF NOT EXISTS ix_internal_documents_created_by     ON internal_documents(created_by);
CREATE INDEX IF NOT EXISTS ix_internal_documents_status         ON internal_documents(status);

CREATE TABLE IF NOT EXISTS internal_document_log (
    id         SERIAL PRIMARY KEY,
    doc_id     INTEGER NOT NULL REFERENCES internal_documents(id) ON DELETE CASCADE,
    action     VARCHAR(30) NOT NULL,
    izoh       TEXT,
    actor_id   INTEGER REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_internal_document_log_doc_id ON internal_document_log(doc_id);
