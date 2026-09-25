-- Davomat arizasiga bo'lim boshlig'i bosqichi (bolim_kutilmoqda -> kutilmoqda).
-- Backend ishga tushganda avtomatik qo'llanadi (main.py); qo'lda ham xavfsiz.
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS bolim_by INTEGER REFERENCES employees(id);
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS bolim_at TIMESTAMP;
