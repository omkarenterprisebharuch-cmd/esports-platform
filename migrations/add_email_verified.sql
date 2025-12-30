-- Migration: Add email_verified field to users table
-- Created: December 30, 2025
-- Purpose: Track email verification status for account security

-- Add email_verified column to users table
-- Default to FALSE for new users, requiring email verification
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Set existing users as verified (they were already using the platform)
-- This is a one-time migration for existing users
UPDATE users 
SET email_verified = TRUE 
WHERE email_verified IS NULL OR email_verified = FALSE;

-- For users who registered via OTP verification (is_verified = TRUE), 
-- they have already verified their email
UPDATE users 
SET email_verified = TRUE 
WHERE is_verified = TRUE;

-- Create index for queries filtering by email_verified status
CREATE INDEX IF NOT EXISTS idx_users_email_verified 
ON users(email_verified);

-- Create composite index for common query pattern (active + verified)
CREATE INDEX IF NOT EXISTS idx_users_active_email_verified 
ON users(is_active, email_verified) 
WHERE is_active = TRUE;

-- Add comment to document the column
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address. Required for certain actions like tournament registration and team creation.';
