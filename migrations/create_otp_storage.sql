-- Create OTP storage table
-- Run with: npx ts-node scripts/run-migration.ts create_otp_storage.sql

-- ============================================
-- OTP Storage (for email verification during registration)
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    attempts INT DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to ensure only one active OTP per email
    CONSTRAINT unique_active_otp UNIQUE (email)
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- Index for cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- ============================================
-- Pending Registrations (for storing user data between send-otp and verify-otp)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_registrations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    consent_ip VARCHAR(45),
    consent_user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to ensure only one pending registration per email
    CONSTRAINT unique_pending_registration UNIQUE (email)
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON pending_registrations(email);

-- Index for cleanup of expired registrations
CREATE INDEX IF NOT EXISTS idx_pending_reg_expires ON pending_registrations(expires_at);

-- ============================================
-- Cleanup function for expired OTPs and registrations
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_otp_data()
RETURNS void AS $$
BEGIN
    -- Delete expired OTPs
    DELETE FROM otp_codes WHERE expires_at < NOW();
    
    -- Delete expired pending registrations
    DELETE FROM pending_registrations WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============ Verification ============
DO $$
BEGIN
    RAISE NOTICE 'OTP storage tables created successfully!';
    RAISE NOTICE 'Tables created: otp_codes, pending_registrations';
END $$;
