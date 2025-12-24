-- Push Subscriptions Table for Web Push Notifications
-- Stores browser push subscription data for each user/device

-- Drop existing table if it exists (to recreate with correct schema)
DROP TABLE IF EXISTS push_subscriptions;

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    device_type VARCHAR(20),  -- 'desktop', 'mobile', 'tablet'
    browser VARCHAR(50),
    os VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint on endpoint (one subscription per browser)
    UNIQUE(endpoint)
);

-- Index for finding all subscriptions for a user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
    ON push_subscriptions(user_id);

-- Index for finding active subscriptions only
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active 
    ON push_subscriptions(user_id, is_active) WHERE is_active = TRUE;

-- Comment on table
COMMENT ON TABLE push_subscriptions IS 'Stores web push notification subscriptions. One user can have multiple subscriptions (different devices/browsers).';
