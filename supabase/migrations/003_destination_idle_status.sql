-- Add 'idle' as the initial state for stream destinations.
-- 'stopped' implied a stream had run and ended; newly-added destinations
-- should start as 'idle' (configured but not yet streaming).
ALTER TYPE destination_status ADD VALUE IF NOT EXISTS 'idle';

ALTER TABLE stream_destinations ALTER COLUMN status SET DEFAULT 'idle';

-- Backfill: existing 'stopped' rows were created with the wrong default
-- and were never streamed, so reclassify them as 'idle'.
UPDATE stream_destinations SET status = 'idle' WHERE status = 'stopped';
