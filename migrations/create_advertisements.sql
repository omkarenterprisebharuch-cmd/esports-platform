-- Create advertisements and tracking system
-- Run with: npx ts-node scripts/run-migration.ts create_advertisements.sql

-- ============================================
-- Advertisement Placements (predefined slots)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_placements (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(100) NOT NULL, -- e.g., 'dashboard_top', 'registration_interstitial', 'tournament_sidebar'
    ad_type VARCHAR(20) NOT NULL CHECK (ad_type IN ('banner', 'video', 'native', 'interstitial')),
    width INT, -- Optional dimensions for banners
    height INT,
    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0, -- Higher priority = shown first
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Advertisements (the actual ads)
-- ============================================
CREATE TABLE IF NOT EXISTS advertisements (
    id SERIAL PRIMARY KEY,
    
    -- Basic Info
    name VARCHAR(200) NOT NULL,
    advertiser_name VARCHAR(200),
    advertiser_email VARCHAR(255),
    
    -- Creative Assets
    ad_type VARCHAR(20) NOT NULL CHECK (ad_type IN ('banner', 'video', 'native', 'interstitial')),
    image_url TEXT, -- For banners/native ads
    video_url TEXT, -- For video ads
    thumbnail_url TEXT, -- Video thumbnail or fallback image
    title VARCHAR(200), -- For native ads
    description TEXT, -- For native ads
    cta_text VARCHAR(50) DEFAULT 'Learn More', -- Call-to-action button text
    destination_url TEXT NOT NULL, -- Click-through URL
    
    -- Targeting
    placement_ids TEXT[], -- Array of placement IDs where this ad can appear
    target_games TEXT[], -- Optional: Only show for specific games
    target_regions TEXT[], -- Optional: Geographic targeting
    
    -- Scheduling
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    
    -- Budget & Pricing
    pricing_model VARCHAR(20) DEFAULT 'cpm' CHECK (pricing_model IN ('cpm', 'cpc', 'cpa', 'flat')),
    price_amount DECIMAL(10, 2) DEFAULT 0, -- Price per unit (CPM/CPC) or flat rate
    daily_budget DECIMAL(10, 2), -- Optional daily spend limit
    total_budget DECIMAL(10, 2), -- Optional total campaign budget
    
    -- Limits
    daily_impression_limit INT, -- Max impressions per day
    total_impression_limit INT, -- Max total impressions
    daily_click_limit INT, -- Max clicks per day
    frequency_cap INT DEFAULT 3, -- Max times to show to same user per day
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'paused', 'completed', 'rejected')),
    rejection_reason TEXT,
    
    -- Metrics (denormalized for quick access)
    total_impressions INT DEFAULT 0,
    total_clicks INT DEFAULT 0,
    total_spend DECIMAL(10, 2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- Ad Impressions (tracking each view)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_impressions (
    id SERIAL PRIMARY KEY,
    ad_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
    placement_id VARCHAR(50) NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
    
    -- User Info (optional for anonymous tracking)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100), -- For frequency capping without login
    
    -- Context
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_hash VARCHAR(64), -- Hashed IP for fraud detection (not stored raw)
    
    -- Device Info
    device_type VARCHAR(20), -- mobile, tablet, desktop
    browser VARCHAR(50),
    os VARCHAR(50),
    
    -- Metrics
    view_duration_ms INT, -- How long the ad was visible
    viewability_percent INT, -- Percentage of ad visible on screen
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Ad Clicks (tracking each click)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_clicks (
    id SERIAL PRIMARY KEY,
    ad_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
    impression_id INT REFERENCES ad_impressions(id) ON DELETE SET NULL,
    placement_id VARCHAR(50) NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
    
    -- User Info
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    
    -- Context
    page_url TEXT,
    destination_url TEXT,
    ip_hash VARCHAR(64),
    
    -- Fraud Detection
    time_to_click_ms INT, -- Time between impression and click
    is_valid BOOLEAN DEFAULT true, -- False if detected as fraudulent
    fraud_reason TEXT,
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Daily Ad Stats (aggregated for reporting)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_daily_stats (
    id SERIAL PRIMARY KEY,
    ad_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
    placement_id VARCHAR(50) REFERENCES ad_placements(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    
    -- Metrics
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    unique_impressions INT DEFAULT 0, -- Unique users
    unique_clicks INT DEFAULT 0,
    total_view_time_ms BIGINT DEFAULT 0,
    avg_viewability_percent DECIMAL(5, 2) DEFAULT 0,
    
    -- Revenue
    spend DECIMAL(10, 2) DEFAULT 0,
    
    -- Calculated (for quick access)
    ctr DECIMAL(5, 4) DEFAULT 0, -- Click-through rate
    
    -- Unique constraint
    UNIQUE(ad_id, placement_id, stat_date)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Advertisements
CREATE INDEX IF NOT EXISTS idx_ads_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_ads_dates ON advertisements(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ads_type ON advertisements(ad_type);
CREATE INDEX IF NOT EXISTS idx_ads_placements ON advertisements USING GIN(placement_ids);

-- Impressions
CREATE INDEX IF NOT EXISTS idx_impressions_ad ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_impressions_placement ON ad_impressions(placement_id);
CREATE INDEX IF NOT EXISTS idx_impressions_user ON ad_impressions(user_id);
CREATE INDEX IF NOT EXISTS idx_impressions_session ON ad_impressions(session_id);
CREATE INDEX IF NOT EXISTS idx_impressions_date ON ad_impressions(created_at);

-- Clicks
CREATE INDEX IF NOT EXISTS idx_clicks_ad ON ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_clicks_date ON ad_clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_valid ON ad_clicks(is_valid);

-- Daily Stats
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON ad_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_ad ON ad_daily_stats(ad_id);

-- ============================================
-- Insert Default Placements
-- ============================================
INSERT INTO ad_placements (id, name, description, location, ad_type, width, height, priority) VALUES
    ('dashboard_top', 'Dashboard Top Banner', 'Large banner at the top of the dashboard', 'dashboard', 'banner', 728, 90, 100),
    ('dashboard_sidebar', 'Dashboard Sidebar', 'Vertical banner in dashboard sidebar', 'dashboard', 'banner', 300, 250, 80),
    ('tournament_list_top', 'Tournament List Header', 'Banner above tournament listings', 'tournaments', 'banner', 728, 90, 90),
    ('tournament_detail_sidebar', 'Tournament Detail Sidebar', 'Ad on tournament detail page', 'tournament_detail', 'banner', 300, 250, 70),
    ('registration_interstitial', 'Registration Interstitial', 'Full-screen ad after registration', 'registration', 'interstitial', NULL, NULL, 100),
    ('registration_success', 'Registration Success', 'Banner on registration success page', 'registration', 'banner', 468, 60, 60),
    ('leaderboard_sidebar', 'Leaderboard Sidebar', 'Ad on leaderboard page', 'leaderboard', 'banner', 300, 600, 50),
    ('mobile_bottom', 'Mobile Bottom Banner', 'Sticky banner at bottom on mobile', 'mobile', 'banner', 320, 50, 40),
    ('video_preroll', 'Video Pre-roll', 'Video ad before tournament streams', 'video', 'video', NULL, NULL, 100)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Function to Update Ad Stats
-- ============================================
CREATE OR REPLACE FUNCTION update_ad_daily_stats(
    p_ad_id INT,
    p_placement_id VARCHAR(50),
    p_date DATE,
    p_impressions INT DEFAULT 0,
    p_clicks INT DEFAULT 0,
    p_spend DECIMAL(10, 2) DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    INSERT INTO ad_daily_stats (ad_id, placement_id, stat_date, impressions, clicks, spend)
    VALUES (p_ad_id, p_placement_id, p_date, p_impressions, p_clicks, p_spend)
    ON CONFLICT (ad_id, placement_id, stat_date)
    DO UPDATE SET
        impressions = ad_daily_stats.impressions + EXCLUDED.impressions,
        clicks = ad_daily_stats.clicks + EXCLUDED.clicks,
        spend = ad_daily_stats.spend + EXCLUDED.spend,
        ctr = CASE 
            WHEN (ad_daily_stats.impressions + EXCLUDED.impressions) > 0 
            THEN (ad_daily_stats.clicks + EXCLUDED.clicks)::DECIMAL / (ad_daily_stats.impressions + EXCLUDED.impressions)
            ELSE 0 
        END;
    
    -- Also update denormalized counters on advertisements table
    UPDATE advertisements
    SET 
        total_impressions = total_impressions + p_impressions,
        total_clicks = total_clicks + p_clicks,
        total_spend = total_spend + p_spend,
        updated_at = NOW()
    WHERE id = p_ad_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to Get Eligible Ads for Placement
-- ============================================
CREATE OR REPLACE FUNCTION get_eligible_ads(
    p_placement_id VARCHAR(50),
    p_user_session VARCHAR(100) DEFAULT NULL,
    p_limit INT DEFAULT 1
) RETURNS TABLE (
    ad_id INT,
    name VARCHAR(200),
    ad_type VARCHAR(20),
    image_url TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    title VARCHAR(200),
    description TEXT,
    cta_text VARCHAR(50),
    destination_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as ad_id,
        a.name,
        a.ad_type,
        a.image_url,
        a.video_url,
        a.thumbnail_url,
        a.title,
        a.description,
        a.cta_text,
        a.destination_url
    FROM advertisements a
    WHERE 
        a.status = 'active'
        AND p_placement_id = ANY(a.placement_ids)
        AND (a.start_date IS NULL OR a.start_date <= NOW())
        AND (a.end_date IS NULL OR a.end_date > NOW())
        AND (a.total_impression_limit IS NULL OR a.total_impressions < a.total_impression_limit)
        AND (a.daily_impression_limit IS NULL OR (
            SELECT COUNT(*) FROM ad_impressions 
            WHERE ad_id = a.id AND created_at >= CURRENT_DATE
        ) < a.daily_impression_limit)
        -- Frequency cap check
        AND (p_user_session IS NULL OR a.frequency_cap IS NULL OR (
            SELECT COUNT(*) FROM ad_impressions 
            WHERE ad_id = a.id 
            AND session_id = p_user_session 
            AND created_at >= CURRENT_DATE
        ) < a.frequency_cap)
    ORDER BY RANDOM() -- Simple random rotation, can be weighted later
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
