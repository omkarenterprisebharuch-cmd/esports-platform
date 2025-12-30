-- GDPR Compliance: Privacy Policy Tracking and Account Deletion
-- Run this migration to add GDPR-related fields to users table

-- Add privacy policy tracking fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(20),
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);

-- Add soft delete support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create table to track consent history (audit trail)
CREATE TABLE IF NOT EXISTS user_consent_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- 'privacy_policy', 'terms_of_service', 'marketing'
    consent_version VARCHAR(20) NOT NULL,
    consented BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table to track account deletion requests
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'completed', 'cancelled'
    scheduled_deletion_at TIMESTAMP WITH TIME ZONE, -- 30-day grace period
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deletion_requested ON users(deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_history_user ON user_consent_history(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON account_deletion_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON account_deletion_requests(scheduled_deletion_at) 
    WHERE status = 'scheduled';

-- Comment on columns for documentation
COMMENT ON COLUMN users.privacy_policy_accepted_at IS 'Timestamp when user accepted privacy policy';
COMMENT ON COLUMN users.privacy_policy_version IS 'Version of privacy policy accepted (e.g., "1.0")';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - user data anonymized';
COMMENT ON COLUMN users.deletion_requested_at IS 'When user requested account deletion';
