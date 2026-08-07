-- "Obyektda chiqdim" ariza turi uchun vaqt oralig'i ustunlari.

ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS object_time_from VARCHAR(5);
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS object_time_to VARCHAR(5);
