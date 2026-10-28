-- Ishdan bo'shagan xodimlarni o'chirish o'rniga arxivlash.
-- Backend ishga tushganda (main.py) avtomatik qo'llanadi; qo'lda ishga tushirish uchun:
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
