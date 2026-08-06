-- Yangi status turlari (Xizmat safarida / O'quv ta'tilida / Mehnatga layoqatsiz)
-- va ularning muddatini saqlash uchun ustunlar.

ALTER TYPE employee_status_enum ADD VALUE IF NOT EXISTS 'xizmat_safarida';
ALTER TYPE employee_status_enum ADD VALUE IF NOT EXISTS 'oquv_tatilida';
ALTER TYPE employee_status_enum ADD VALUE IF NOT EXISTS 'mehnatga_layoqatsiz';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_date_from VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_date_to VARCHAR(10);
