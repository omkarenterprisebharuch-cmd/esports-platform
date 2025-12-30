-- Tournament Waitlist System Migration
-- Adds waitlist functionality to tournament registrations

-- Add waitlist-related columns to tournament_registrations
ALTER TABLE tournament_registrations 
ADD COLUMN IF NOT EXISTS is_waitlisted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waitlist_position INTEGER,
ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promoted_from_waitlist BOOLEAN DEFAULT FALSE;

-- Create index for waitlist queries
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist 
ON tournament_registrations(tournament_id, is_waitlisted, waitlist_position) 
WHERE is_waitlisted = TRUE;

-- Create index for finding promotable waitlist entries
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist_position 
ON tournament_registrations(tournament_id, waitlist_position ASC) 
WHERE is_waitlisted = TRUE AND status = 'registered';

-- Add comment for documentation
COMMENT ON COLUMN tournament_registrations.is_waitlisted IS 'Whether this registration is on the waitlist';
COMMENT ON COLUMN tournament_registrations.waitlist_position IS 'Position in waitlist queue (1 = first in line)';
COMMENT ON COLUMN tournament_registrations.promoted_at IS 'When user was promoted from waitlist to registered';
COMMENT ON COLUMN tournament_registrations.promoted_from_waitlist IS 'Whether user was originally on waitlist and got promoted';
