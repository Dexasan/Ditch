-- Reclassify 'stopped' destinations that never actually streamed.
UPDATE stream_destinations SET status = 'idle' WHERE status = 'stopped';

-- Set 'idle' as the new default for new destinations.
ALTER TABLE stream_destinations ALTER COLUMN status SET DEFAULT 'idle';