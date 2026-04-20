ALTER TABLE practices
  ADD COLUMN IF NOT EXISTS medication_enabled boolean NOT NULL DEFAULT true;

UPDATE practices
SET medication_enabled = true
WHERE medication_enabled IS DISTINCT FROM true;
