-- Migration: Add tournament scheduling support
-- This allows admins/hosts to create recurring tournaments that auto-publish

-- Add scheduling columns to tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'once',
ADD COLUMN IF NOT EXISTS publish_time TIME,
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_published_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint separately (some Postgres versions don't support IF NOT EXISTS for constraints)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_schedule_type_check'
  ) THEN
    ALTER TABLE tournaments ADD CONSTRAINT tournaments_schedule_type_check 
    CHECK (schedule_type IN ('once', 'everyday'));
  END IF;
END $$;

-- Create index for efficient querying of templates
CREATE INDEX IF NOT EXISTS idx_tournaments_template ON tournaments(is_template) WHERE is_template = TRUE;
CREATE INDEX IF NOT EXISTS idx_tournaments_schedule_type ON tournaments(schedule_type) WHERE schedule_type = 'everyday';

-- Comment on columns
COMMENT ON COLUMN tournaments.schedule_type IS 'once = one-time tournament, everyday = recurring daily tournament';
COMMENT ON COLUMN tournaments.publish_time IS 'Time when the recurring tournament should be published (used for everyday schedule)';
COMMENT ON COLUMN tournaments.is_template IS 'True if this is a template for recurring tournaments, not a live tournament';
COMMENT ON COLUMN tournaments.template_id IS 'Reference to the template tournament if this was auto-created from a template';
COMMENT ON COLUMN tournaments.last_published_at IS 'Last time a tournament was auto-published from this template';
