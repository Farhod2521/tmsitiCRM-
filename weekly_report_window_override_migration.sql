CREATE TABLE IF NOT EXISTS weekly_report_window_overrides (
    id          SERIAL PRIMARY KEY,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,
    week        INTEGER NOT NULL,
    open_until  TIMESTAMP NOT NULL,
    created_by  INTEGER REFERENCES employees(id),
    created_at  TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_weekly_window_override UNIQUE (year, month, week)
);
