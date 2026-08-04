-- attendance_notes: bitta kun (note_date) o'rniga sanalar oralig'i (date_from/date_to)
-- + kechikish uchun taxminiy kelish vaqti (expected_time)

ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS date_from VARCHAR(10);
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS date_to VARCHAR(10);
ALTER TABLE attendance_notes ADD COLUMN IF NOT EXISTS expected_time VARCHAR(5);

UPDATE attendance_notes SET date_from = note_date WHERE date_from IS NULL;
UPDATE attendance_notes SET date_to   = note_date WHERE date_to   IS NULL;

ALTER TABLE attendance_notes ALTER COLUMN date_from SET NOT NULL;
ALTER TABLE attendance_notes ALTER COLUMN date_to   SET NOT NULL;

ALTER TABLE attendance_notes DROP CONSTRAINT IF EXISTS uq_attendance_note_day;
ALTER TABLE attendance_notes DROP COLUMN IF EXISTS note_date;
