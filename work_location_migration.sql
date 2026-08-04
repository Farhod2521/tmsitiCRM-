-- Ish joyi (vazirlik / labaratoriya) va lokatsiya sozlamalari

DO $$ BEGIN
    CREATE TYPE work_location_enum AS ENUM ('vazirlik', 'labaratoriya');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS work_location work_location_enum NOT NULL DEFAULT 'vazirlik';

CREATE TABLE IF NOT EXISTS location_settings (
    id             SERIAL PRIMARY KEY,
    location_type  work_location_enum UNIQUE NOT NULL,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    radius_meters  INTEGER NOT NULL DEFAULT 100,
    updated_at     TIMESTAMP DEFAULT NOW()
);

INSERT INTO location_settings (location_type, radius_meters)
VALUES ('vazirlik', 100), ('labaratoriya', 100)
ON CONFLICT (location_type) DO NOTHING;
