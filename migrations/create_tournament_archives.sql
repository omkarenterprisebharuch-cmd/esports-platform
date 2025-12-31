-- Migration: Create tournament archives and cleanup infrastructure
-- Date: 2026-01-01
-- Purpose: Support archival of completed tournaments and resource cleanup

-- ============ Tournament Archives Table ============

-- Create tournament_archives table for storing archived tournament data
CREATE TABLE IF NOT EXISTS tournament_archives (
    id SERIAL PRIMARY KEY,
    original_id INTEGER UNIQUE NOT NULL,  -- Reference to original tournament ID
    tournament_name VARCHAR(255) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    tournament_type VARCHAR(20) NOT NULL,
    host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    prize_pool DECIMAL(10, 2) DEFAULT 0,
    entry_fee DECIMAL(10, 2) DEFAULT 0,
    max_teams INTEGER NOT NULL,
    final_teams INTEGER DEFAULT 0,  -- How many teams actually participated
    tournament_start_date TIMESTAMP WITH TIME ZONE,
    tournament_end_date TIMESTAMP WITH TIME ZONE,
    leaderboard_snapshot JSONB,  -- Complete leaderboard data as JSON
    registration_count INTEGER DEFAULT 0,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE tournament_archives IS 'Stores archived tournament data for completed tournaments older than retention period';
COMMENT ON COLUMN tournament_archives.leaderboard_snapshot IS 'JSON snapshot of full leaderboard at time of archival';
COMMENT ON COLUMN tournament_archives.original_id IS 'Original tournament ID - kept for reference/audit';

-- Indexes for tournament_archives
CREATE INDEX IF NOT EXISTS idx_tournament_archives_game_type ON tournament_archives(game_type);
CREATE INDEX IF NOT EXISTS idx_tournament_archives_host ON tournament_archives(host_id);
CREATE INDEX IF NOT EXISTS idx_tournament_archives_dates ON tournament_archives(tournament_start_date, tournament_end_date);
CREATE INDEX IF NOT EXISTS idx_tournament_archives_archived_at ON tournament_archives(archived_at);

-- ============ Add Archive Columns to Tournaments ============

-- Add is_archived and archived_at columns to tournaments table
DO $$ 
BEGIN
    -- Add is_archived column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournaments' AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE tournaments ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add archived_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournaments' AND column_name = 'archived_at'
    ) THEN
        ALTER TABLE tournaments ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Index for finding archived tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_archived ON tournaments(is_archived) WHERE is_archived = TRUE;
CREATE INDEX IF NOT EXISTS idx_tournaments_archive_candidates ON tournaments(status, is_archived, tournament_end_date) 
    WHERE status = 'completed' AND (is_archived IS NULL OR is_archived = FALSE);

-- ============ Cleanup Job Log Table ============

-- Track cleanup job executions for monitoring
CREATE TABLE IF NOT EXISTS cleanup_job_logs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL,  -- 'full_cleanup', 'archive_only', 'media_only', etc.
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    success BOOLEAN,
    summary JSONB,  -- Detailed results per operation
    error_message TEXT,
    triggered_by VARCHAR(50),  -- 'cron', 'manual', 'api'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cleanup logs
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_type_date ON cleanup_job_logs(job_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_success ON cleanup_job_logs(success, started_at DESC);

-- Comment for documentation
COMMENT ON TABLE cleanup_job_logs IS 'Tracks execution history of cleanup jobs for monitoring and debugging';

-- ============ Verify Tables Exist for Cleanup ============

-- Ensure notifications table exists (for cleanup)
-- Note: This should already exist from notifications migration
-- Just adding a check here for completeness

-- ============ Grant Permissions ============

-- Grant necessary permissions if using role-based access
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_archives TO your_app_role;
-- GRANT SELECT, INSERT ON cleanup_job_logs TO your_app_role;
-- GRANT USAGE, SELECT ON SEQUENCE tournament_archives_id_seq TO your_app_role;
-- GRANT USAGE, SELECT ON SEQUENCE cleanup_job_logs_id_seq TO your_app_role;

-- ============ Verification ============

-- Verify tables were created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_archives') THEN
        RAISE NOTICE 'SUCCESS: tournament_archives table created';
    ELSE
        RAISE EXCEPTION 'FAILED: tournament_archives table not created';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cleanup_job_logs') THEN
        RAISE NOTICE 'SUCCESS: cleanup_job_logs table created';
    ELSE
        RAISE EXCEPTION 'FAILED: cleanup_job_logs table not created';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournaments' AND column_name = 'is_archived'
    ) THEN
        RAISE NOTICE 'SUCCESS: is_archived column added to tournaments';
    ELSE
        RAISE EXCEPTION 'FAILED: is_archived column not added';
    END IF;
END $$;
