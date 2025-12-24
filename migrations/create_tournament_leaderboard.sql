-- Tournament Leaderboard Table
-- Run this SQL to create the leaderboard table in your PostgreSQL database

CREATE TABLE IF NOT EXISTS tournament_leaderboard (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    position INTEGER NOT NULL CHECK (position >= 1 AND position <= 100),
    kills INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    prize_amount DECIMAL(10, 2) DEFAULT 0,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique position per tournament
    UNIQUE(tournament_id, position),
    
    -- Ensure either team_id or user_id is set (not both null for winners)
    CHECK (team_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_tournament_id ON tournament_leaderboard(tournament_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_position ON tournament_leaderboard(tournament_id, position);

-- Add trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_leaderboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_leaderboard_updated_at ON tournament_leaderboard;
CREATE TRIGGER trigger_update_leaderboard_updated_at
    BEFORE UPDATE ON tournament_leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION update_leaderboard_updated_at();

-- Comment on table
COMMENT ON TABLE tournament_leaderboard IS 'Stores tournament results and rankings for top 3 winners';
COMMENT ON COLUMN tournament_leaderboard.position IS 'Position in leaderboard (1 = winner, 2 = runner-up, 3 = third place)';
COMMENT ON COLUMN tournament_leaderboard.kills IS 'Total kills achieved in the tournament';
COMMENT ON COLUMN tournament_leaderboard.points IS 'Total points earned in the tournament';
COMMENT ON COLUMN tournament_leaderboard.prize_amount IS 'Prize money awarded to this rank';
