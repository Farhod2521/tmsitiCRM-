CREATE TABLE IF NOT EXISTS weekly_report_files (
    id                SERIAL PRIMARY KEY,
    weekly_report_id  INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
    file_name         VARCHAR(300) NOT NULL,
    file_b64          TEXT NOT NULL,
    uploaded_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_weekly_report_files_weekly_report_id ON weekly_report_files(weekly_report_id);
