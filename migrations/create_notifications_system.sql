-- Notifications System Migration
-- Adds notification preferences to users and creates notification history table

-- Add notification preferences column to users table (JSONB for flexibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email": {
    "tournament_updates": true,
    "registration_confirmation": true,
    "room_credentials": true,
    "tournament_reminders": true,
    "waitlist_updates": true,
    "marketing": false
  },
  "push": {
    "tournament_updates": true,
    "registration_confirmation": true,
    "room_credentials": true,
    "tournament_reminders": true,
    "waitlist_updates": true,
    "marketing": false
  }
}'::jsonb;

-- Drop existing notifications table if exists (to recreate with new structure)
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications history table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification content
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  
  -- Notification metadata
  notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
  -- Types: tournament_update, registration, room_credentials, reminder, waitlist, system, marketing
  
  category VARCHAR(50) NOT NULL DEFAULT 'info',
  -- Categories: info, success, warning, error
  
  -- Related entities (optional)
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  
  -- Delivery tracking
  channels_sent TEXT[] DEFAULT '{}', -- ['email', 'push']
  email_sent_at TIMESTAMPTZ,
  push_sent_at TIMESTAMPTZ,
  
  -- Read status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Action URL (optional - for clickable notifications)
  action_url VARCHAR(500),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Optional expiration for time-sensitive notifications
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_tournament ON notifications(tournament_id) WHERE tournament_id IS NOT NULL;

-- Add index on user notification preferences for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_notification_preferences ON users USING GIN (notification_preferences);

-- Comments for documentation
COMMENT ON COLUMN users.notification_preferences IS 'User notification preferences as JSONB. Structure: { email: {...}, push: {...} }';
COMMENT ON TABLE notifications IS 'Stores notification history for users. Supports both push and email notifications.';
COMMENT ON COLUMN notifications.notification_type IS 'Notification type: tournament_update, registration, room_credentials, reminder, waitlist, system, marketing';
COMMENT ON COLUMN notifications.category IS 'Visual category: info, success, warning, error';
COMMENT ON COLUMN notifications.channels_sent IS 'Array of channels used to deliver notification: email, push';
