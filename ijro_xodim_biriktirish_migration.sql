-- Bo'lim ichida topshiriqni aniq xodimga biriktirish (ijro nazorati) uchun.
ALTER TABLE ijro_doc_bolimlar ADD COLUMN IF NOT EXISTS xodim_id INTEGER REFERENCES employees(id);
ALTER TABLE ijro_doc_bolimlar ADD COLUMN IF NOT EXISTS xodim_assigned_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS ijro_doc_bolim_assign_log (
  id SERIAL PRIMARY KEY,
  doc_bolim_id INTEGER NOT NULL REFERENCES ijro_doc_bolimlar(id) ON DELETE CASCADE,
  xodim_id INTEGER NOT NULL REFERENCES employees(id),
  assigned_by INTEGER REFERENCES employees(id),
  assigned_at TIMESTAMP DEFAULT NOW()
);
