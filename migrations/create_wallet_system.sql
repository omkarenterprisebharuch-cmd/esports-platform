-- Virtual Currency Deposit System Migration
-- Created: 2026-01-01
-- Description: Creates tables for wallet transactions and deposit requests

-- ============================================
-- 1. Wallet Transactions Table
-- ============================================
-- Stores all wallet transactions (deposits, withdrawals, entry fees, prizes, refunds)

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(30) NOT NULL,
    -- Types: 
    --   'deposit' - Generic deposit
    --   'withdrawal' - Withdrawal
    --   'entry_fee' - Tournament entry fee deduction
    --   'prize' - Prize money credit
    --   'refund' - Refund for cancelled tournament
    --   'owner_deposit' - Deposit from owner to organizer
    --   'organizer_deposit' - Deposit from organizer to user
    status VARCHAR(20) DEFAULT 'completed' NOT NULL,
    -- Status: 'pending', 'completed', 'failed'
    description TEXT,
    reference_id VARCHAR(100),
    -- Reference to deposit_request id or tournament id
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Who initiated the deposit (owner/organizer id)
    balance_before DECIMAL(10,2),
    -- Wallet balance before this transaction
    balance_after DECIMAL(10,2),
    -- Wallet balance after this transaction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for wallet_transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_from_user ON wallet_transactions(from_user_id);

-- ============================================
-- 2. Deposit Requests Table
-- ============================================
-- Stores deposit requests from organizers to owner, and users to organizers

CREATE TABLE IF NOT EXISTS deposit_requests (
    id SERIAL PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The user (or organizer) requesting the deposit
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The user (owner or organizer) who will process the request
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    request_type VARCHAR(30) NOT NULL,
    -- Types:
    --   'organizer_to_owner' - Organizer requesting from Owner
    --   'user_to_organizer' - User requesting from Organizer
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- Status: 'pending', 'approved', 'rejected', 'cancelled'
    requester_note TEXT,
    -- Note/reason from the requester
    responder_note TEXT,
    -- Note from the approver/rejector
    payment_proof_url TEXT,
    -- Optional: URL to payment proof image (Cloudinary)
    payment_reference VARCHAR(100),
    -- Optional: UPI transaction ID, bank reference, etc.
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Who approved/rejected the request
    processed_at TIMESTAMP,
    -- When the request was processed
    transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    -- Link to the resulting transaction (if approved)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for deposit_requests
CREATE INDEX IF NOT EXISTS idx_deposit_requests_requester ON deposit_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_target ON deposit_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_type ON deposit_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_created_at ON deposit_requests(created_at DESC);

-- Composite index for common query: pending requests for a target
CREATE INDEX IF NOT EXISTS idx_deposit_requests_target_pending 
ON deposit_requests(target_id, status) WHERE status = 'pending';

-- ============================================
-- 3. Add trigger for updated_at
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for wallet_transactions
DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON wallet_transactions;
CREATE TRIGGER update_wallet_transactions_updated_at
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for deposit_requests
DROP TRIGGER IF EXISTS update_deposit_requests_updated_at ON deposit_requests;
CREATE TRIGGER update_deposit_requests_updated_at
    BEFORE UPDATE ON deposit_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Comments for documentation
-- ============================================

COMMENT ON TABLE wallet_transactions IS 'Stores all wallet transactions including deposits, withdrawals, entry fees, and prizes';
COMMENT ON TABLE deposit_requests IS 'Stores deposit requests from organizers to owner and from users to organizers';

COMMENT ON COLUMN wallet_transactions.type IS 'Transaction type: deposit, withdrawal, entry_fee, prize, refund, owner_deposit, organizer_deposit';
COMMENT ON COLUMN wallet_transactions.from_user_id IS 'The user who initiated the deposit (owner or organizer)';
COMMENT ON COLUMN wallet_transactions.balance_before IS 'User wallet balance before this transaction';
COMMENT ON COLUMN wallet_transactions.balance_after IS 'User wallet balance after this transaction';

COMMENT ON COLUMN deposit_requests.request_type IS 'Request type: organizer_to_owner or user_to_organizer';
COMMENT ON COLUMN deposit_requests.payment_proof_url IS 'Optional Cloudinary URL for payment proof screenshot';
COMMENT ON COLUMN deposit_requests.payment_reference IS 'Optional payment reference like UPI transaction ID';
