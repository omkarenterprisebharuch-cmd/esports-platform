# Esports Platform - Implementation Roadmap

> **Created:** December 30, 2025  
> **Purpose:** Sequential implementation guide for platform features  
> **Status:** Planning Document - Follow this sequence for future development

---

## 📋 Implementation Phases Overview

| Phase | Focus Area | Priority | Estimated Effort |
|-------|-----------|----------|------------------|
| Phase 1 | Security Foundation | 🔴 Critical | 2-3 weeks |
| Phase 2 | Core User Experience | 🔴 Critical | 3-4 weeks |
| Phase 3 | Competitive Tournament Features | 🟠 High | 4-5 weeks |
| Phase 4 | Cost Optimization | 🟠 High | 2-3 weeks |
| Phase 5 | Monetization | 🟡 Medium | 3-4 weeks |
| Phase 6 | Advanced Features | 🟢 Low | Ongoing |

---

## 🔐 Phase 1: Security Foundation (Priority: Critical)

> **Goal:** Establish a secure foundation before adding user-facing features

### 1.1 Authentication & Authorization (Week 1)
- [x] **JWT authentication with refresh tokens** ✅ (Implemented December 30, 2025)
  - Access token (15min) + refresh token (7 days) pattern
  - Refresh tokens stored in httpOnly cookies with hash in DB
  - Token rotation on refresh (old token revoked, new token issued)
  - Auto-refresh on 401 response in api-client
  - Files: `auth.ts`, `api/auth/login`, `api/auth/refresh`, `api/auth/logout`, `api-client.ts`
  - Migration: `create_refresh_tokens.sql`
  
- [x] **Bcrypt password hashing** ✅ (Already implemented)
  - Verify salt rounds (minimum 12)
  
- [x] **Role-based access control (Admin, Organizer, Player)** ✅ (Implemented December 30, 2025)
  - Added `role` ENUM field to users table (player, organizer, owner)
  - Created permission matrix in `auth.ts` with role-specific permissions
  - Implemented `requireRole()`, `requireOrganizer()`, `requireOwner()` middleware
  - Owner Portal at `/owner` with platform stats and user management
  - Ability to assign/change user roles from Owner Portal
  - Migration: `add_user_roles.sql`
  - Files: `auth.ts`, `api/owner/users`, `api/owner/stats`, `(dashboard)/owner/page.tsx`

### 1.2 Account Security (Week 1-2)
- [x] **Email verification for new accounts** ✅ (Implemented December 30, 2025)
  - Added `email_verified` field to users table
  - Migration: `add_email_verified.sql`
  - OTP-verified users get email_verified=TRUE automatically
  - Block unverified users from tournament registration, team creation/joining
  - Added `requireEmailVerified()` helper in auth.ts
  - Added `emailVerificationRequiredResponse()` helper in api-response.ts
  - Token includes email_verified flag for frontend use

- [ ] **Two-factor authentication (2FA) via SMS/Email**
  - Implement TOTP-based 2FA
  - Add backup codes generation
  - Create 2FA setup flow in profile

- [x] **Session timeout and auto-logout** ✅ (Implemented December 30, 2025)
  - Added `useIdleTimeout` hook with 30-minute idle detection
  - Cross-tab session sync via localStorage events
  - Idle warning modal 2 minutes before logout
  - "Remember me" option extends session to 30 days (vs default 7 days)
  - Force logout on password change (revokes all refresh tokens)
  - Files: `useIdleTimeout.ts`, `auth.ts`, `login/route.ts`, `reset-password/route.ts`

### 1.3 API Security (Week 2)
- [ ] **Rate limiting on API endpoints** ✅ (Partially implemented)
  - Expand rate limiting to all sensitive endpoints
  - Implement tiered limits (auth: strict, public: moderate)
  - Add rate limit headers to responses

- [ ] **Input validation using Zod schemas** ✅ (Partially implemented)
  - Audit all API routes for validation coverage
  - Create shared validation schemas
  - Add validation error formatting

- [ ] **SQL injection prevention with parameterized queries** ✅ (Using pg library)
  - Audit all database queries
  - Document secure query patterns

- [ ] **XSS protection with sanitization** ✅ (Implemented December 30, 2025)
  - Created comprehensive `sanitize.ts` utility using isomorphic-dompurify
  - Functions: `escapeHtml`, `stripHtml`, `sanitizeText`, `sanitizeRichText`, `sanitizeUrl`
  - Specialized sanitizers: `sanitizeUsername`, `sanitizeTeamName`, `sanitizeTournamentName`, `sanitizeChatMessage`, `sanitizeGameUid`
  - Applied to: chat messages (chat-utils.ts), tournament creation, team creation/join, user profile updates
  - Implemented Content Security Policy headers in next.config.ts
  - Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
  - Files: `sanitize.ts`, `next.config.ts`, `chat-utils.ts`, `tournaments/route.ts`, `teams/route.ts`, `teams/join/route.ts`, `users/profile/route.ts`

- [ ] **CSRF token protection** ✅ (Implemented)
  - Verify coverage on all state-changing endpoints

### 1.4 Monitoring & Logging (Week 2-3)
- [ ] **Account activity logging and monitoring**
  - Create `user_activity_logs` table
  - Log login attempts, password changes, profile updates
  - Add activity view in user profile

- [ ] **Admin audit trail logging**
  - Create `admin_audit_logs` table
  - Log all admin actions with before/after values
  - Build admin audit log viewer

- [x] **Multi-device login alerts** ✅ (Implemented December 30, 2025)
  - Created `device-detection.ts` utility to parse user-agent and generate device fingerprints
  - Device detection identifies: device type (desktop/mobile/tablet), browser, OS, versions
  - Login route now detects new devices by comparing fingerprints with existing sessions
  - Sends email alert with device info (browser, OS, IP, time) when new device detected
  - Created `/api/auth/sessions` endpoint for session management:
    - GET: List all active sessions with device info
    - DELETE: Revoke specific session (logout device)
    - POST: Revoke all sessions except current
  - Files: `device-detection.ts`, `email.ts`, `login/route.ts`, `sessions/route.ts`

- [x] **IP-based fraud detection** ✅ (Implemented December 30, 2025)
  - Created `login_history` table to track all login attempts with status and IP
  - Created `known_user_ips` table to track trusted IPs per user
  - Migration: `create_login_history.sql`
  - Created `fraud-detection.ts` utility with:
    - Velocity checking: blocks IP after 5 failed attempts in 15 min
    - Email velocity: blocks after 10 failed attempts per email
    - New IP detection: flags first-time IPs for users
    - Suspicious pattern detection: multiple users per IP, high login frequency
    - Risk scoring system (0-100) based on multiple factors
  - Login route now records all attempts (success/failed/blocked/suspicious)
  - Sends email alerts for suspicious logins with risk level and reasons
  - Created `/api/owner/fraud` endpoint for admin review:
    - GET: Fraud stats, flagged logins, user login history
    - POST: Mark flagged login as reviewed
  - Files: `fraud-detection.ts`, `email.ts`, `login/route.ts`, `owner/fraud/route.ts`

- [ ] **Suspicious activity flagging system**
  - Define suspicious patterns (rapid registrations, etc.)
  - Create flagging mechanism
  - Admin review queue

### 1.5 Data Protection (Week 3)
- [x] **Data encryption for sensitive information** ✅ (Implemented December 30, 2025)
  - Created `encryption.ts` utility with AES-256-GCM authenticated encryption
  - Encrypts PII at rest: phone_number (users), in_game_ids (users), game_uid (team_members)
  - Unique IV (Initialization Vector) per encryption for maximum security
  - Authentication tag prevents data tampering
  - Secure key derivation using PBKDF2 with SHA-512
  - Key management via ENCRYPTION_KEY environment variable
  - Backward compatible: safely handles unencrypted legacy data
  - Applied to: user profile API, auth/me, teams routes, owner/users
  - Files: `encryption.ts`, `users/profile/route.ts`, `auth/me/route.ts`, `teams/*.ts`, `owner/users/route.ts`

- [x] **GDPR-compliant data handling** ✅ (Implemented December 30, 2025)
  - Created `gdpr.ts` utility with comprehensive GDPR functions
  - Account deletion with 30-day grace period and immediate options
  - Data anonymization on deletion (username, email, phone, game IDs)
  - Privacy policy and terms of service acceptance tracking with versioning
  - Consent history logging with IP and user agent
  - Created `/api/users/account` endpoint for deletion management
  - Created `/api/users/privacy-consent` endpoint for consent tracking
  - Updated registration flow with required privacy policy/terms checkboxes
  - Consent recorded on user registration with version tracking
  - Migration: `add_gdpr_compliance.sql`
  - Files: `gdpr.ts`, `users/account/route.ts`, `users/privacy-consent/route.ts`, `register/page.tsx`, `verify-otp/route.ts`

- [ ] **Secure file upload validation for screenshots**
  - Validate file types (magic bytes, not just extension)
  - Implement file size limits
  - Scan for malicious content

- [ ] **Automated backup system for database**
  - Set up daily automated backups
  - Test restore procedures
  - Implement point-in-time recovery

- [ ] **Secure webhook handling for payment confirmations**
  - Validate webhook signatures
  - Implement idempotency
  - Add webhook logging

---

## 👤 Phase 2: Core User Experience (Priority: Critical)

> **Goal:** Polish the core user journey for players

### 2.1 Registration & Discovery (Week 4)
- [ ] **One-click tournament registration with team/solo options** ✅ (Partially implemented)
  - Streamline registration flow
  - Add "Quick Register" for returning teams
  - Save preferred registration settings

- [x] **Tournament discovery with filters (game, prize pool, date)** ✅ (Implemented December 30, 2025)
  - Added filter parameters to tournaments API: game_type, min_prize, max_prize, start_date, end_date
  - Implemented sorting options: date_asc, date_desc, prize_desc, prize_asc, popularity
  - Created advanced filter UI with collapsible panel on dashboard
  - Real-time filter application with active filter summary display
  - Prize pool range presets (₹0-500, ₹500-1000, ₹1000-5000, etc.)
  - Files: `api/tournaments/route.ts`, `dashboard/page.tsx`

- [x] **Personalized tournament recommendations** ✅ (Implemented December 30, 2025)
  - Created `/api/tournaments/recommendations` endpoint
  - Analyzes user's registration history to determine preferred games
  - Calculates game preference weights (% of registrations per game)
  - Prioritizes: open registration > upcoming > game preference > prize pool
  - Shows "Tournaments you might like" section on dashboard
  - Falls back to popular tournaments for new users with no history
  - Displays personalized recommendation reasons (e.g., "Your favorite game • 60% of your tournaments")
  - Files: `api/tournaments/recommendations/route.ts`, `dashboard/page.tsx`

- [x] **Tournament waitlist system** ✅ (Implemented December 30, 2025)
  - Add waitlist when tournament is full
  - Auto-promote when spot opens
  - Send notification on promotion

### 2.2 Notifications & Reminders (Week 4-5)
- [x] **Email and push notifications for tournament updates** ✅ (Fully implemented December 30, 2025)
  - Created comprehensive notification system in `notifications.ts`
  - User notification preferences stored in JSONB column (email/push toggles per type)
  - Notification types: tournament_update, registration, room_credentials, reminder, waitlist, system, marketing
  - Created `/api/notifications/preferences` endpoint (GET/PUT) for preference management
  - Created `/api/notifications/history` endpoint for notification history (GET/PUT/POST/DELETE)
  - Created NotificationCenter UI component with:
    - Bell icon with unread badge in dashboard header
    - Notifications list with read/unread status
    - Mark all as read functionality
    - Preferences tab with toggles for each notification type
  - Helper functions: sendRegistrationConfirmation, sendRoomCredentialsNotification, sendTournamentReminder, sendWaitlistPromotionNotification
  - Migration: `create_notifications_system.sql`
  - Files: `notifications.ts`, `NotificationCenter.tsx`, `preferences/route.ts`, `history/route.ts`, `layout.tsx`

- [ ] **Tournament reminder system (24hr, 1hr before)**
  - Create scheduled job for reminders
  - Allow users to set reminder preferences
  - Send via email + push

- [ ] **Real-time tournament bracket updates via Socket.IO** ✅ (Socket.IO setup done)
  - Implement bracket update events
  - Add live score updates
  - Show real-time registration count

### 2.3 Player Profiles (Week 5-6)
- [ ] **Player/team profile dashboard with stats**
  - Calculate win/loss ratio
  - Show tournament participation history
  - Display earnings and achievements

- [ ] **Tournament history and achievement display**
  - Create achievements system (First Win, 10 Tournaments, etc.)
  - Add badges to profiles
  - Show tournament placement history

- [ ] **In-game ID verification and validation**
  - Add game ID fields to profile
  - Implement verification flow (screenshot or API)
  - Show verified badge on profile

### 2.4 Social Features (Week 6) ✅ (Fully implemented )
- [ ] **Quick share tournament links to social media**
  - Add share buttons (WhatsApp, Twitter, Discord)
  - Generate OG meta tags for previews
  - Create shareable tournament cards

- [ ] **Embedded Discord/WhatsApp group links**
  - Add group link field to tournaments
  - Display prominent join button
  - Track click analytics

### 2.5 UI/UX Enhancements (Week 6-7)
- [ ] **Mobile-first responsive design for on-the-go registration** ✅ (Implemented)
  - Audit all pages for mobile usability
  - Optimize touch targets
  - Test on various devices

- [ ] **Dark/light theme toggle** ✅ (Implemented)
  - Implement theme context
  - Add toggle in header/settings
  - Persist preference in localStorage

- [ ] **PWA for app-like experience**  ✅ (Implemented)
  - Create manifest.json ✅ (Partially done)
  - Implement offline support
  - Add install prompt
  - Enable background sync

---

## 🏆 Phase 3: Competitive Tournament Features (Priority: High)

> **Goal:** Build robust tournament management system

### 3.1 Tournament Creation (Week 7-8) ✅ (Fully implemented )
- [ ] **Quick tournament creation wizard**
  - Multi-step form with progress indicator
  - Smart defaults based on game type
  - Preview before publish

- [ ] **Template-based tournament setup**
  - Create tournament templates table
  - Allow saving custom templates
  - Provide pre-built templates per game

- [ ] **Game-specific rules template library**
  - Create rules templates for each game
  - Allow organizers to customize
  - Auto-attach based on game type

- [ ] **Multiple game support (Valorant, Free Fire, BGMI)**
  - Add game configuration system
  - Game-specific fields and validation
  - Game-specific room credential formats

### 3.2 Bracket System (Week 8-10)
- [ ] **Multiple bracket formats (Single/Double Elimination, Round Robin, Swiss)**
  - Design bracket data structure
  - Implement bracket generation algorithms
  - Create bracket visualization component

- [ ] **Automatic bracket generation and seeding**
  - Random seeding option
  - Skill-based seeding (using past performance)
  - Manual seeding override

- [ ] **Automatic next round advancement**
  - Trigger on match result submission
  - Handle byes automatically
  - Update bracket in real-time

- [ ] **Tiebreaker rules automation**
  - Define tiebreaker criteria per format
  - Implement head-to-head comparison
  - Handle point differential

### 3.3 Match Management (Week 10-11)
- [ ] **Room ID and password distribution system** ✅ (Implemented)
  - Enhance with auto-generation option
  - Add room credential templates
  - Implement copy-to-clipboard for all players

- [ ] **Match result submission portal for players**
  - Create match result form
  - Allow both teams to submit
  - Handle conflicting submissions

- [ ] **Screenshot/proof upload system for match results**
  - Design proof upload UI
  - Store in Cloudinary
  - Link proofs to match records

- [ ] **Match scheduling with conflict detection**
  - Allow organizers to set match times
  - Detect player conflicts across tournaments
  - Send match time notifications

### 3.4 Check-in & Attendance (Week 11)✅ (Fully implemented )
- [ ] **Automated check-in system before tournament start**
  - Enable check-in window (30 min before)
  - Track team check-in status
  - Send check-in reminders

- [ ] **Disqualification automation for no-shows**
  - Auto-DQ after check-in window closes
  - Notify affected teams
  - Advance opponents automatically

### 3.5 Results & Prizes (Week 11-12)
- [ ] **Prize pool tracker and distribution system**
  - Track prize pool contributions
  - Calculate placement prizes
  - Generate prize distribution report

- [x] **Winner announcement and hall of fame** ✅ (Implemented December 31, 2025)
  - **Hall of Fame API** (`/api/hall-of-fame`):
    - GET: Fetch comprehensive leaderboard data with filtering
    - Query params: game_type (freefire/pubg/valorant/codm), period (all/month/week), limit
    - Returns: Top players, top teams, recent tournament winners, game stats, platform stats
    - Aggregates wins, podium finishes, earnings, kills, points
  - **Hall of Fame Page** (`/hall-of-fame`):
    - Platform statistics dashboard (tournaments completed, unique champions, prize distributed, total kills)
    - Game-specific filter cards with click-to-filter
    - Period filter (all time, this month, this week)
    - Tabbed interface: Top Players, Top Teams, Recent Winners
    - Top 3 players spotlight with medal styling (gold/silver/bronze gradients)
    - Full leaderboard table for players beyond top 3
    - Team cards with win breakdown (1st/2nd/3rd place)
    - Recent tournament cards with winner details, kills, points, prize amounts
    - Dark mode support throughout
  - **Navigation**: Added 🏆 Hall of Fame link to sidebar menu
  - **Files**: `api/hall-of-fame/route.ts`, `hall-of-fame/page.tsx`, `layout.tsx`

- [ ] **Custom scoring and point systems**
  - Support kill points + placement points
  - Configurable point values
  - Leaderboard calculation

### 3.6 Advanced Tournament Features (Week 12)
- [ ] **Season-based tournament series**
  - Create series/season entity
  - Track points across tournaments
  - Season leaderboard

- [ ] **Qualifier and main event management**
  - Link qualifier to main event
  - Auto-promote qualifiers
  - Track qualification status


- [ ] **Tournament result dispute resolution system**
  - Create dispute submission form
  - Admin dispute review queue
  - Resolution tracking

- [x] **Anti-cheating player reporting mechanism** ✅ (Fully Implemented December 31, 2025)
  - **Player Reports API** (`/api/reports`):
    - POST: Submit a report with category, subcategory, description, evidence URLs
    - GET: Retrieve reports with pagination and filtering (admin only)
    - Categories: cheating, toxicity, account_sharing, exploit, other (25+ subcategories)
  - **Report Management** (`/api/reports/[id]`):
    - GET: Get specific report details with reporter/reported user info
    - PUT: Update report status (pending → under_review → resolved/dismissed)
    - DELETE: Delete report (owner only)
  - **Categories API** (`/api/reports/categories`):
    - Returns hierarchical category structure with descriptions
  - **Game ID Ban System** (`/api/bans/game-id`):
    - POST: Create game ID ban with reason, duration, game type
    - GET: List all bans with filtering (status, game type, search)
    - PUT/DELETE: Update or remove bans
    - `/api/bans/game-id/[id]` for individual ban management
    - Automatic ban checking on tournament registration
  - **Admin Reports Page** (`/admin/reports`):
    - Filter by status, category, date range
    - Stats cards showing total/pending/resolved/dismissed counts
    - Report list with reporter info, reason, evidence, status
  - **Admin Bans Page** (`/admin/bans`):
    - Create new game ID bans with reason and duration
    - Filter by status (active/expired), game type
    - Search by game ID
    - Ban statistics dashboard
  - **Report Player Modal** (`/components/reports/ReportPlayerModal.tsx`):
    - Reusable component for submitting reports from tournament pages
  - **Database Schema** (`create_player_reports_system.sql`):
    - `player_reports` table with full audit trail
    - `game_id_bans` table with game-specific bans
    - Indexes for efficient querying
  - **Files**: `api/reports/*`, `api/bans/game-id/*`, `admin/reports/page.tsx`, `admin/bans/page.tsx`, `ReportPlayerModal.tsx`, `ban-check.ts`

---

## ⚡ Phase 4: Cost Optimization (Priority: High)

> **Goal:** Optimize for scale and reduce operational costs

### 4.1 Frontend Optimization (Week 13)
- [ ] **Code splitting and lazy loading** ✅ (Partially implemented)
  - Audit all dynamic imports
  - Lazy load non-critical components
  - Measure bundle size improvements

- [x] **Bundle size analysis and optimization** ✅ (Implemented December 31, 2025)
  - **Bundle Analyzer**: Already configured in `next.config.ts` with `@next/bundle-analyzer`
  - **Analysis Script**: Created `scripts/analyze-bundle.ts` for detailed dependency analysis
  - **Key Findings**:
    - Client bundle dependencies: ~115 KB gzipped total
    - Largest client packages: react-dom (40KB), socket.io-client (40KB), isomorphic-dompurify (15KB), zod (13KB)
    - Server-only packages correctly excluded: pg, bcryptjs, jsonwebtoken, nodemailer, cloudinary, sharp, web-push
  - **Optimizations Applied**:
    - Converted `socket.io-client` to dynamic import in `socket-client.ts` (~40KB savings on initial load)
    - `initSocket()` now async with lazy loading
    - Server packages already in `serverExternalPackages` config
  - Run analyzer: `$env:ANALYZE="true"; npm run build`
  - Run analysis script: `npx tsx scripts/analyze-bundle.ts`

- [x] **Tree shaking for unused code removal** ✅ (Implemented December 31, 2025)
  - **ES Modules**: All imports use proper ES module syntax with named imports
  - **sideEffects Configuration**: Added to `package.json`:
    ```json
    "sideEffects": ["*.css", "*.scss", "src/app/globals.css"]
    ```
  - **Barrel Files Audit**: All index.ts files use explicit named re-exports
  - **No Namespace Imports**: Verified no `import * as` patterns in src/
  - **Verification Script**: Updated `scripts/analyze-bundle.ts` with tree shaking audit
  - **Results**: 
    - ✅ All imports use named imports (`import { x } from "module"`)
    - ✅ No namespace imports found
    - ✅ Barrel files properly configured
    - ✅ sideEffects field enables bundler optimizations

- [ ] **Image optimization via Cloudinary with compression** ✅ (Implemented)
  - Add auto-format transformation
  - Implement responsive images
  - Set quality optimization

- [x] **Cloudinary auto-format and quality optimization** ✅ (Implemented December 31, 2025)
  - **OptimizedImage Component** (`components/ui/OptimizedImage.tsx`):
    - `getOptimizedUrl()`: Transform Cloudinary URLs with `f_auto,q_auto` parameters
    - `getBlurPlaceholderUrl()`: Generate 20x20px blur placeholders (LQIP)
    - `getResponsiveSrcSet()`: Generate responsive srcset at 7 breakpoints (320-1536px)
  - **Components**:
    - `OptimizedImage`: Full-featured image with blur placeholder, lazy loading, responsive srcset
    - `OptimizedAvatar`: Avatar-specific with face detection crop and fallback to ui-avatars.com
    - `OptimizedBanner`: Tournament banner preset with 1200x630 dimensions
  - **Features**:
    - Auto-format: Serves WebP/AVIF based on browser support
    - Auto-quality: Cloudinary selects optimal compression
    - Blur placeholders: 20x20px blurred thumbnails load instantly
    - Intersection Observer lazy loading: Images load 50px before viewport entry
    - Priority loading option for above-fold images
  - **Usage**:
    ```tsx
    import { OptimizedImage, OptimizedAvatar } from "@/components/ui";
    <OptimizedImage src={url} alt="..." width={800} placeholder="blur" />
    <OptimizedAvatar src={avatarUrl} alt="User" size={48} />
    ```
  - **Files**: `components/ui/OptimizedImage.tsx`, `components/ui/index.ts`

### 4.2 Backend Optimization (Week 13-14)
- [x] **Database connection pooling (PostgreSQL)** ✅ (Implemented December 31, 2025)
  - **Pool Configuration** (`src/lib/db.ts`):
    - `max: 3` - Optimized for Aiven free tier (3-connection limit)
    - `idleTimeoutMillis: 30000` - Release idle connections after 30s
    - `connectionTimeoutMillis: 10000` - 10s connection timeout
  - **Connection Queue Management**:
    - Custom queue system for requests when all connections are busy
    - `QUEUE_TIMEOUT: 30000` - Max 30s wait in queue before rejection
    - Automatic queue processing when connections are released
  - **Retry Logic**:
    - `query()` and `queryOne()` helpers with automatic retry (2 attempts)
    - Retries on: connection terminated, timeout, refused, ECONNRESET
  - **Batch Query Helpers**:
    - `batchQuery()` - Execute multiple queries in single transaction
    - `batchInsert()` - Efficient multi-row inserts
    - `fetchByIds()` - Prevent N+1 queries
    - `checkExistence()` - Bulk existence checks
  - **Monitoring Endpoint** (`/api/owner/db-stats`):
    - Real-time pool statistics (active, idle, waiting, queue length)
    - Utilization percentage and health status
    - Configuration details and recommendations
  - **Pool Events Logging**:
    - Connection open/close logged in development
    - Error handling to prevent crashes
  - **Files**: `lib/db.ts`, `api/owner/db-stats/route.ts`

- [x] **Database query optimization with indexes** ✅ (Implemented December 31, 2025)
  - **Existing Indexes** (`migrations/add_performance_indexes.sql`):
    - Tournament registrations: tournament_id, user_id, team_id, status (with composites)
    - Tournaments: status, host_id, game_type, start_date
    - Teams: captain_id, team_code, is_active
    - Team members: team_id, user_id (with active membership composite)
    - Chat messages: tournament_id, user_id, created_at
    - Leaderboard: tournament_id, user_id, team_id, position
    - Users: email, username, is_host
  - **New Optimized Indexes** (`migrations/optimize_indexes_v2.sql`):
    - **Hall of Fame optimization**:
      - `idx_leaderboard_position_covering` - Covering index for leaderboard queries
      - `idx_leaderboard_user_tournament` - User stats aggregation
      - `idx_leaderboard_team_tournament` - Team stats aggregation
      - `idx_leaderboard_podium` - Partial index for top 3 positions
    - **Tournament listing optimization**:
      - `idx_tournaments_list_filter` - Composite for status + date filters
      - `idx_tournaments_game_status_date` - Game + status + date combination
      - `idx_tournaments_prize_pool` - Prize range queries
      - `idx_tournaments_completed` - Completed tournaments (hall of fame)
      - `idx_tournaments_registration_open` - Active registration filter
    - **Expression indexes** (case-insensitive lookups):
      - `idx_users_email_lower` - Case-insensitive email lookup
      - `idx_users_username_lower` - Case-insensitive username lookup
      - `idx_teams_code_lower` - Case-insensitive team code lookup
    - **Notifications optimization**:
      - `idx_notifications_unread_count` - Unread badge count
      - `idx_notifications_user_created_read` - List pagination
    - **Security indexes**:
      - `idx_banned_ids_active_check` - Ban check during registration
      - `idx_reports_admin_list` - Admin report listing
  - **Query Analysis Tools**:
    - `scripts/analyze-queries.ts` - CLI tool for query analysis
      - Commands: `indexes`, `unused`, `missing`, `explain`, `stats`, `size`, `all`
      - Interactive mode with colored output
      - EXPLAIN ANALYZE on common query patterns
    - `/api/owner/db-indexes` - Admin API endpoint
      - Index usage statistics
      - Unused index detection
      - Table stats with index coverage %
      - Automated recommendations
  - **Run Migration**: 
    ```bash
    psql $DATABASE_URL -f migrations/optimize_indexes_v2.sql
    ```
  - **Analyze Queries**:
    ```bash
    npx tsx scripts/analyze-queries.ts all
    ```
  - **Files**: `migrations/optimize_indexes_v2.sql`, `scripts/analyze-queries.ts`, `api/owner/db-indexes/route.ts`

- [ ] **Pagination for large data sets** ✅ (Implemented)
  - Verify all list endpoints paginated
  - Implement cursor-based pagination for real-time data
  - Add page size limits

- [x] **API response caching with Redis** ✅ (Implemented December 31, 2025)
  - **Redis Client** (`src/lib/redis.ts`):
    - ioredis-based client with connection pooling
    - Graceful fallback when Redis is unavailable
    - Auto-reconnection with exponential backoff
    - Lazy connection to avoid blocking startup
  - **TTL Presets**:
    - `TTL.SHORT` (60s) - Frequently changing data
    - `TTL.MEDIUM` (300s) - Default for lists (tournaments)
    - `TTL.LONG` (900s) - Stable data (hall of fame)
    - `TTL.HOUR` (3600s) - Rarely changing data
    - `TTL.DAY` (86400s) - Static data
  - **Cache Operations**:
    - `cache.get<T>(key)` - Get cached value
    - `cache.set(key, value, ttl)` - Set with TTL
    - `cache.getOrSet(key, fetcher, ttl)` - Cache-aside pattern
    - `cache.del(key)` - Delete single key
    - `invalidatePattern(pattern)` - Pattern-based invalidation
  - **Cache Key Builders** (`cacheKeys`):
    - `tournamentList({ status, gameType, page, limit, sort })` - Tournament list queries
    - `tournament(id)` - Single tournament
    - `hallOfFame(gameType, period)` - Hall of fame pages
    - `userProfile(userId)` - User profiles
    - `team(teamId)` - Team data
  - **Cached Endpoints**:
    - `GET /api/tournaments` - 5 min TTL, user-specific requests excluded
    - `GET /api/hall-of-fame` - 15 min TTL
  - **Cache Invalidation**:
    - `invalidateTournamentCaches(id?)` - Clears tournament + hall of fame caches
    - Called on: POST/PUT/DELETE `/api/tournaments`
  - **Monitoring** (`/api/owner/cache-stats`):
    - Connection status and memory usage
    - Health recommendations
  - **Environment Variables**:
    - `REDIS_URL` - Redis connection string (e.g., `redis://localhost:6379`)
    - `REDIS_ENABLED` - Set to "false" to disable caching
  - **Files**: `lib/redis.ts`, `api/tournaments/route.ts`, `api/tournaments/[id]/route.ts`, `api/hall-of-fame/route.ts`, `api/owner/cache-stats/route.ts`

- [x] **Database query result caching** ✅ (Implemented December 31, 2025)
  - **Database Cache Layer** (`src/lib/db-cache.ts`):
    - Type-safe cached query wrappers for common database operations
    - Transparent caching with automatic fallback to direct DB queries
    - Graceful handling when Redis is unavailable
  - **Cached Queries** (`cachedQueries`):
    - `getUserById(userId)` - User profiles (5 min TTL)
    - `getUserStats(userId)` - Aggregated user statistics (15 min TTL)
    - `getTeamById(teamId)` - Team data with member count (5 min TTL)
    - `getTeamStats(teamId)` - Team tournament stats (15 min TTL)
    - `getTeamMembers(teamId)` - Team member list (5 min TTL)
    - `getTournamentById(id)` - Single tournament details (2 min TTL)
    - `getPopularTournaments(gameType?)` - Popular tournaments (10 min TTL)
    - `getUpcomingTournaments(limit)` - Upcoming tournaments (5 min TTL)
    - `getUserRegistrations(userId)` - Active registrations (2 min TTL)
    - `getPlatformStats()` - Platform-wide statistics (1 hour TTL)
    - `getGameStats(gameType)` - Game-specific statistics (1 hour TTL)
    - `getTournamentLeaderboard(id)` - Leaderboard (5 min active, 1 hour completed)
  - **Cache Invalidation** (`invalidateDbCache`):
    - `user(userId)` - Invalidates profile, stats, registrations
    - `team(teamId)` - Invalidates team data, stats, members
    - `tournament(tournamentId)` - Invalidates tournament + popular/upcoming lists
    - `registration(userId, tournamentId)` - Invalidates user and tournament caches
    - `leaderboard(tournamentId)` - Invalidates leaderboard + hall of fame
    - `stats()` - Invalidates all stats caches
    - `all()` - Full cache clear (use sparingly)
  - **Cache Warming** (`warmCache`):
    - `popularTournaments()` - Warms popular tournaments by game type
    - `upcomingTournaments()` - Warms upcoming tournament list
    - `platformStats()` - Warms platform and game statistics
    - `tournament(id)` - Warms specific tournament before start
    - `all()` - Warms all essential caches (run on startup)
  - **Cache Warming Script** (`scripts/warm-cache.ts`):
    - CLI utility: `npx tsx scripts/warm-cache.ts [--all|--tournaments|--stats|--tournament <id>]`
    - Run on server startup or via cron job
    - Reports memory usage and timing
  - **Cache Warming API** (`/api/owner/cache-warm`):
    - POST: Warm caches (owner or cron secret)
    - DELETE: Invalidate caches (owner only)
    - Supports X-Cron-Secret header for automation
  - **Integrated Endpoints**:
    - `GET /api/owner/stats` - 5 min cache
    - `PUT /api/users/profile` - Invalidates user cache
    - `POST /api/registrations/register` - Invalidates registration caches
    - `POST /api/teams` - Invalidates team cache
  - **Environment Variables**:
    - `CRON_SECRET` - Secret for automated cache warming
  - **Files**: `lib/db-cache.ts`, `scripts/warm-cache.ts`, `api/owner/cache-warm/route.ts`, `api/owner/stats/route.ts`, `api/users/profile/route.ts`, `api/registrations/register/route.ts`, `api/teams/route.ts`

- [x] **Compressed API responses (gzip/brotli)** ✅ (Implemented December 31, 2025)
  - **Next.js Configuration** (`next.config.ts`):
    - `compress: true` - Enables gzip compression for all responses
    - Brotli handled automatically by Vercel/CDN in production
    - Added `Vary: Accept-Encoding` header for proper CDN caching
  - **Cache-Control Headers**:
    - `/api/tournaments` - `public, max-age=30, stale-while-revalidate=60`
    - `/api/hall-of-fame` - `public, max-age=300, stale-while-revalidate=600`
    - `/_next/static/*` - `public, max-age=31536000, immutable`
  - **Compression Ratios** (JSON responses):
    - Gzip: ~70-80% size reduction
    - Brotli: ~75-85% size reduction (when available)
  - **Verification Script** (`scripts/verify-compression.ts`):
    - Tests endpoints with different Accept-Encoding headers
    - Calculates theoretical gzip/brotli savings
    - Reports server compression status
    - Usage: `npx tsx scripts/verify-compression.ts`
  - **Monitoring Endpoint** (`/api/owner/compression-stats`):
    - Sample compression ratios for typical API responses
    - Configuration status and recommendations
  - **Production Notes**:
    - Vercel: Automatic gzip + brotli based on Accept-Encoding
    - Self-hosted: Configure nginx with `gzip on` and `brotli on`
    - Cloudflare: Enable "Brotli" in Speed settings
  - **Files**: `next.config.ts`, `scripts/verify-compression.ts`, `api/owner/compression-stats/route.ts`

### 4.3 Static Generation (Week 14)
- [x] **Next.js static page generation for public pages** ✅ (Implemented December 31, 2025)
  - **Fully Static Pages** (build-time generation, never revalidate):
    - `/privacy-policy` - Privacy policy page
      - Removed `"use client"` directive
      - Added `export const dynamic = "force-static"`
      - Added `export const revalidate = false`
      - Added SEO metadata with Open Graph tags
    - `/terms` - Terms of service page
      - Same static configuration as privacy policy
  - **ISR Pages** (incremental static regeneration):
    - `/leaderboard` - Public hall of fame page
      - Server-side data fetching with `async function getHallOfFameData()`
      - `export const revalidate = 900` (15 minute regeneration)
      - Full SEO metadata for public discovery
      - Platform stats, game stats, top players, top teams
      - No authentication required
  - **Next.js App Router Patterns**:
    - `export const dynamic = "force-static"` - Force static at build time
    - `export const revalidate = false` - Never revalidate (fully static)
    - `export const revalidate = <seconds>` - ISR period
    - `fetch()` with `next: { revalidate: X }` for granular caching
  - **Files**: 
    - `app/privacy-policy/page.tsx`
    - `app/terms/page.tsx`
    - `app/leaderboard/page.tsx`

- [x] **Incremental static regeneration (ISR) for tournament pages** ✅ (Implemented January 1, 2026)
  - **Public Tournament Detail Page** (`/tournament/[id]`):
    - Server-side rendered with `export const revalidate = 120` (2 minutes)
    - Full SEO metadata with Open Graph and Twitter cards
    - Tournament banner, stats grid, schedule, rules, registration CTA
    - `generateStaticParams()` pre-renders top 20 recent tournaments at build
    - Dynamic metadata based on tournament data (name, game, prize, banner)
    - No authentication required - shareable public URLs
  - **On-Demand Revalidation API** (`/api/revalidate`):
    - POST endpoint to trigger ISR revalidation
    - Types: `tournament`, `leaderboard`, `hall-of-fame`, `all`
    - Authentication: user token (owner/organizer), cron secret, or revalidation secret
    - Returns list of revalidated paths with timestamp
  - **Automatic Revalidation Triggers**:
    - Tournament creation (`POST /api/tournaments`) - revalidates dashboard, leaderboard
    - Tournament update (`PUT /api/tournaments/[id]`) - revalidates tournament page, leaderboard
    - Tournament deletion (`DELETE /api/tournaments/[id]`) - revalidates tournament, dashboard
    - Leaderboard update (`POST /api/tournaments/[id]/leaderboard`) - revalidates tournament, hall of fame
  - **Implementation Patterns**:
    ```tsx
    // Route-level revalidation
    export const revalidate = 120; // Seconds
    
    // Pre-generate popular pages at build
    export async function generateStaticParams() { ... }
    
    // On-demand revalidation in API routes
    import { revalidatePath } from "next/cache";
    revalidatePath(`/tournament/${id}`);
    ```
  - **Environment Variables**:
    - `REVALIDATION_SECRET` - Secret for external webhook revalidation
    - `CRON_SECRET` - Secret for scheduled revalidation jobs
  - **Files**:
    - `app/tournament/[id]/page.tsx` - Public ISR tournament page
    - `api/revalidate/route.ts` - On-demand revalidation endpoint
    - `api/tournaments/route.ts` - Added revalidation on create
    - `api/tournaments/[id]/route.ts` - Added revalidation on update/delete
    - `api/tournaments/[id]/leaderboard/route.ts` - Added revalidation on results

- [x] **Server-side rendering only for dynamic content** ✅ (Verified December 31, 2025)
  - **SSR (Dynamic) Pages** - Require authentication or real-time data:
    - `/dashboard` - User-specific dashboard
    - `/my-teams` - User's team list
    - `/my-tournaments` - User's registrations
    - `/profile` - User settings
    - `/owner/*` - Admin portal
  - **Client Components** - Interactive features:
    - Chat components - Real-time messaging
    - Check-in components - Live status updates
    - Tournament bracket - Live updates
  - All dynamic pages use `"use client"` where interactivity is needed
  - Server components used for data fetching, client components for interactivity

- [x] **CDN integration for static assets** ✅ (Implemented January 1, 2026)
  - **Cache-Control Headers** (`next.config.ts`):
    - `/_next/static/*` - 1 year, immutable (JS, CSS chunks)
    - `/_next/image/*` - 1 day with stale-while-revalidate (optimized images)
    - `/*.woff2` - 1 year, immutable (fonts)
    - `/icons/*` - 7 days with stale-while-revalidate (PWA icons)
    - `/*.{png,jpg,webp,avif,svg}` - 7 days with stale-while-revalidate
    - `/manifest.json, /favicon.ico` - 1 day with stale-while-revalidate
    - `/sw.js` - No cache, must-revalidate (service worker)
    - `/tournament/[id]` - 2 min with stale-while-revalidate (ISR pages)
    - `/leaderboard` - 5 min with stale-while-revalidate (ISR page)
    - `/privacy-policy, /terms` - 1 day (static pages)
  - **CDN-Specific Headers**:
    - `CDN-Cache-Control` - Separate directives for edge caches (Vercel, Cloudflare)
    - `Vary: Accept-Encoding` - Proper cache variants for compression
    - `Access-Control-Allow-Origin: *` - CORS for font files
    - `Service-Worker-Allowed: /` - For PWA service worker
  - **Cache Directives Used**:
    - `public` - Cacheable by any cache (CDN, browser)
    - `max-age` - Freshness lifetime in seconds
    - `immutable` - Never revalidate (for hashed assets)
    - `stale-while-revalidate` - Serve stale while fetching fresh
    - `must-revalidate` - Always check origin when stale
  - **Monitoring Endpoint** (`/api/owner/cdn-stats`):
    - Cache configuration reference
    - CDN header explanations
    - Platform-specific recommendations (Vercel, Cloudflare, Nginx)
    - Metrics to track (hit rate, edge response time)
  - **Verification Script** (`scripts/verify-cdn.ts`):
    - Tests cache headers on all endpoints
    - Validates expected max-age and directives
    - Detects CDN cache status (HIT/MISS)
    - Calculates cache hit rate
    - Usage: `npx tsx scripts/verify-cdn.ts [--url <base-url>]`
  - **Platform Integration**:
    - **Vercel**: Headers automatically applied, check x-vercel-cache
    - **Cloudflare**: Set "Browser Cache TTL: Respect Existing Headers"
    - **Nginx**: Add `proxy_cache` and `add_header X-Cache-Status`
  - **Expected Performance**:
    - Static assets: Cache hit rate >95%
    - ISR pages: Cache hit rate >80%
    - Edge response time: <50ms for cached content
  - **Files**:
    - `next.config.ts` - Headers configuration
    - `api/owner/cdn-stats/route.ts` - Monitoring endpoint
    - `scripts/verify-cdn.ts` - CLI verification tool

### 4.4 Real-time Optimization (Week 14-15)
- [x] **Efficient socket connection management** ✅ (Implemented December 31, 2025)
  - **Client-Side (socket-client.ts)**:
    - Lazy loading via dynamic import (~40KB savings - Socket.IO only loaded when needed)
    - Reconnection strategy: 5 attempts, 1s initial delay, exponential backoff
    - Connection timeout: 20 seconds
    - Transports: polling → websocket upgrade for reliability
    - Event handlers for connect, connect_error, disconnect with logging
    - `subscribeToChatEvents()` returns cleanup function for memory management
    - `fetchChatHistory()` API fallback when socket unavailable
  - **Server-Side (socket-server.ts)**:
    - JWT authentication middleware validates token before connection
    - In-memory room management with `Map<string, TournamentRoom>`
    - TournamentRoom tracks: registeredUsers (Set), activeUsers (Set), endTime
    - User verification before allowing room join
    - Database persistence for chat messages (PostgreSQL)
    - Last 50 messages loaded from DB on room join
  - **Standalone Socket Server (socket-server.ts root)**:
    - Separate process on configurable SOCKET_PORT (default 3002)
    - Health check endpoint: `/health` returns room count
    - Database connection pool: max 5, 30s idle timeout, 10s connection timeout
    - Active user count broadcasting on join/leave
    - Graceful disconnect handling
  - **Rate Limiting (chat-utils.ts)**:
    - 20 messages per user per minute per tournament
    - In-memory sliding window tracking
    - `clearTournamentRateLimits()` cleanup on tournament end
  - **Message Processing**:
    - XSS sanitization via sanitize.ts
    - Profanity filtering with word list
    - Message length limit: 500 characters
    - Validation before broadcast
  - **Automatic Cleanup**:
    - 60-second interval checks for expired tournaments
    - Room cleanup with user notification ("chat-closed" event)
    - Rate limit data cleared on tournament end
  - **Error Handling**:
    - Uncaught exception handler
    - Unhandled rejection handler
    - Server error logging
  - **Files**:
    - `src/lib/socket-client.ts` - Client connection with lazy loading
    - `src/lib/socket-server.ts` - Embedded server for Next.js custom server
    - `socket-server.ts` - Standalone socket server with DB persistence
    - `src/lib/chat-utils.ts` - Rate limiting, validation, sanitization
    - `server.ts` - Custom Next.js server with socket integration

- [x] **WebSocket event throttling** ✅ (Implemented January 1, 2026)
  - **Throttling Utilities** (`src/lib/socket-throttle.ts`):
    - `throttle()` - Leading edge throttle with trailing execution
    - `debounce()` - Delay until idle with flush/cancel support
    - `EventBatcher` - Collect events and process in batches
    - `BackpressureHandler` - Flow control for overwhelmed connections
    - `SlidingWindowRateLimiter` - Per-user event rate limiting
    - `TypingThrottler` - Deduplicate rapid typing indicators
    - `createThrottledEmitter()` - Wrapper for socket.emit
  - **Client-Side Throttling** (`socket-client.ts`):
    - Message sending: 500ms throttle prevents spam from rapid clicks
    - Room join: 1s throttle prevents rapid rejoin attempts
    - Typing indicator: 1s throttle reduces typing event frequency
    - Backpressure: Max 20 pending messages, drops new when overwhelmed
    - `sendMessageImmediate()` for programmatic use without throttle
    - `getBackpressureStatus()` and `getConnectionHealth()` for monitoring
  - **Server-Side Throttling** (`socket-server.ts`):
    - Global event rate limiter: 100 events/min per user
    - Server backpressure: Max 100 pending operations across all connections
    - Active user count broadcasts: 2s debounce batches rapid join/leave
    - Per-room typing throttler with 3s timeout
    - Per-room message batcher (for future high-volume scenarios)
    - Acknowledgement support for client backpressure release
  - **Typing Indicators**:
    - Client: `sendTypingIndicator()` and `sendStoppedTyping()` events
    - Server: Per-room `TypingThrottler` deduplicates rapid events
    - Auto-stop typing on message send or 3s timeout
    - `user-typing` and `user-stopped-typing` events to room
  - **Backpressure Handling**:
    - Client: Tracks pending acknowledgements, drops messages when full
    - Server: Rejects operations under pressure with `BACKPRESSURE` code
    - Automatic release at 50% capacity
    - Health endpoint reports backpressure status
  - **Pre-configured Constants** (`THROTTLE_TIMES`):
    - `TYPING_INDICATOR`: 1000ms
    - `MESSAGE_SEND`: 500ms
    - `ROOM_JOIN`: 1000ms
    - `ACTIVE_USERS_UPDATE`: 2000ms
    - `BATCH_MESSAGES`: 100ms
  - **Cleanup on Disconnect**:
    - Cancel throttled operations
    - Stop typing indicators for all rooms
    - Remove from active users
    - Release backpressure
  - **Files**:
    - `src/lib/socket-throttle.ts` - Throttling utilities
    - `src/lib/socket-client.ts` - Client with throttled events
    - `socket-server.ts` - Server with throttling and batching

### 4.5 Maintenance & Cleanup (Week 15)
- [x] **Resource cleanup for completed tournaments** ✅ (Implemented January 1, 2026)
  - **Cleanup Utility Library** (`src/lib/cleanup.ts`):
    - Configurable retention periods for all data types
    - `CLEANUP_CONFIG` with defaults: archive after 90 days, delete archives after 365 days
    - Token retention: 7 days, login history: 90 days, notifications: 30 days
    - Chat messages: 180 days, cancelled registrations: 30 days
  - **Tournament Archival**:
    - `getTournamentsToArchive()` - Find completed tournaments older than retention
    - `archiveTournament()` - Archive single tournament with leaderboard snapshot
    - `archiveCompletedTournaments()` - Batch archive all eligible tournaments
    - Moves essential data to `tournament_archives` table
    - Stores leaderboard as JSONB snapshot
    - Deletes registrations and old chat messages for archived tournaments
  - **Media Cleanup** (Cloudinary):
    - `getOrphanedTournamentMedia()` - Find banners from old archived tournaments
    - `getOrphanedAvatars()` - Find avatars from GDPR-deleted users
    - `cleanupOrphanedMedia()` - Delete orphaned images from Cloudinary
    - Extracts Cloudinary public IDs from URLs for deletion
  - **Session & Token Cleanup**:
    - `cleanupExpiredTokens()` - Remove expired/revoked refresh tokens
    - `cleanupLoginHistory()` - Remove old login history (keeps flagged unreviewed)
    - `cleanupReadNotifications()` - Remove old read notifications
    - `cleanupCancelledRegistrations()` - Remove old cancelled registrations
    - `cleanupOldChatMessages()` - Remove old chat messages (configurable)
    - `cleanupOldKnownIPs()` - Keep only 10 most recent IPs per user
  - **Full Cleanup**:
    - `runFullCleanup()` - Execute all cleanup operations in sequence
    - Returns detailed summary with per-operation results
    - Logs execution to `cleanup_job_logs` table
  - **Statistics**:
    - `getCleanupStats()` - Get counts of items pending cleanup
    - `getArchiveStats()` - Get archive table statistics
  - **Database Migration** (`migrations/create_tournament_archives.sql`):
    - `tournament_archives` table with leaderboard JSONB snapshot
    - `cleanup_job_logs` table for execution tracking
    - Added `is_archived` and `archived_at` columns to tournaments
    - Indexes for efficient archive queries
  - **Cleanup Script** (`scripts/cleanup-resources.ts`):
    - CLI tool for scheduled or manual cleanup
    - Options: `--dry-run`, `--operation <name>`, `--stats`
    - Operations: archive, media, tokens, history, notifications, registrations, chat, ips, all
    - Colored output with duration and item counts
    - Logs execution to database
    - Usage: `npx tsx scripts/cleanup-resources.ts [options]`
  - **Cleanup API** (`/api/owner/cleanup`):
    - GET: View cleanup stats, pending items, archive stats, recent job logs
    - POST: Trigger cleanup operations (owner or cron secret)
    - Supports `X-Cron-Secret` header for automated jobs
    - Request body: `{ "operation": "all" | "scheduled" | "archive" | "media" | ... }`
  - **Cron Setup**:
    - Daily (full cleanup): `0 3 * * * npx tsx scripts/cleanup-resources.ts`
    - Hourly (lightweight): `0 * * * * npx tsx scripts/cleanup-resources.ts --operation scheduled`
    - Vercel/Railway: Use platform's cron job feature
    - Or call POST `/api/owner/cleanup` with `X-Cron-Secret` header
  - **Files**:
    - `src/lib/cleanup.ts` - Core cleanup utility
    - `migrations/create_tournament_archives.sql` - Database schema
    - `scripts/cleanup-resources.ts` - CLI cleanup script
    - `api/owner/cleanup/route.ts` - API endpoint

- [x] **Archival system for old tournament data** ✅ (Included in Resource cleanup above)
  - Tournament archives table with leaderboard snapshots
  - Configurable retention period (90 days before archive)
  - Archive restoration capability

- [x] **Scheduled cleanup jobs for expired data** ✅ (Implemented December 31, 2025)
  - **Lightweight Scheduled Cleanup** (`runScheduledCleanup`) - suitable for hourly cron:
    - Expired refresh tokens cleanup
    - Old read notifications removal
    - Inactive push subscriptions cleanup
    - Old cleanup job logs removal
  - **Full Cleanup** (`runFullCleanup`) - suitable for daily cron:
    - All lightweight operations PLUS:
    - Tournament archival
    - Orphaned media cleanup (Cloudinary)
    - Login history cleanup
    - Cancelled registrations cleanup
    - Old chat messages cleanup
    - Known IPs cleanup
    - Resolved player reports cleanup
  - **Configuration** (in `CLEANUP_CONFIG`):
    - `EXPIRED_TOKENS_RETENTION_DAYS`: 7 days
    - `LOGIN_HISTORY_RETENTION_DAYS`: 90 days
    - `READ_NOTIFICATIONS_RETENTION_DAYS`: 30 days
    - `CHAT_MESSAGES_RETENTION_DAYS`: 180 days
    - `CANCELLED_REGISTRATIONS_RETENTION_DAYS`: 30 days
    - `INACTIVE_PUSH_SUBSCRIPTIONS_DAYS`: 90 days
    - `RESOLVED_REPORTS_RETENTION_DAYS`: 180 days
    - `CLEANUP_LOG_RETENTION_DAYS`: 30 days
  - **Note on In-Memory Data**:
    - OTPs: Stored in memory with auto-cleanup via `setTimeout()` - no database cleanup needed
    - Rate limits: In-memory with auto-cleanup every 5 minutes
    - Pending registrations: In-memory with 15-minute TTL
    - For production scale, these should migrate to Redis
  - **API**: POST `/api/owner/cleanup` with `{ "operation": "scheduled" }`
  - **CLI**: `npx tsx scripts/cleanup-resources.ts --operation scheduled`
  - **Files**: `src/lib/cleanup.ts`

- [x] **Efficient email queuing with batching** ✅ (Implemented January 1, 2026)
  - **Email Queue Library** (`src/lib/email-queue.ts`):
    - In-memory queue with priority support (high/normal/low)
    - Connection pooling for SMTP transport
    - Automatic retry with exponential backoff (3 attempts)
    - Failed email storage for review
  - **Rate Limiting**:
    - `MAX_EMAILS_PER_MINUTE`: 30 (configurable)
    - `MAX_EMAILS_PER_HOUR`: 500 (configurable)
    - Automatic throttling when limits reached
    - Counter reset on minute/hour boundaries
  - **Batching System**:
    - 30-second batch window to collect similar notifications
    - Automatic digest creation for multiple emails to same recipient
    - Max 50 emails per batch
    - Categories: notification, transactional, marketing
  - **Email Types**:
    - `sendImmediateEmail()` - Bypass queue for OTPs (respects rate limits)
    - `queueTransactionalEmail()` - High priority (security alerts, login alerts)
    - `queueNotificationEmail()` - Normal priority, batched (tournament updates)
    - `queueMarketingEmail()` - Low priority, heavily batched
  - **Digest Emails**:
    - When multiple notifications to same recipient within batch window
    - Combines into "You have X new notifications" summary
    - Links to dashboard for details
  - **Queue Processing**:
    - 5-second processing interval
    - Priority order: high → normal → low
    - Scheduled email support (send at future time)
    - Graceful shutdown with queue drain
  - **API Endpoint** (`/api/owner/email-queue`):
    - GET: Queue stats, rate limit status, health recommendations
    - POST `{ "action": "flush" }`: Send all pending immediately
    - POST `{ "action": "clear" }`: Drop all pending emails
  - **Integration**:
    - `email.ts`: OTP emails sent immediately, security alerts queued as transactional
    - `notifications.ts`: All notification emails go through queue
  - **Files**: `src/lib/email-queue.ts`, `api/owner/email-queue/route.ts`, `email.ts`, `notifications.ts`

- [x] **Serverless API routes for infrequent operations** ✅ (Implemented January 1, 2026)
  - **Serverless Optimization Library** (`src/lib/serverless.ts`):
    - Cold start detection with `isColdStart()` and `markWarmed()` functions
    - Instance statistics tracking: uptime, request count, cold start status
    - `RouteTimer` class for performance timing with phase-level granularity
    - Lazy module loading with `lazyImport()` to reduce cold start time
    - Database connection warming with `warmDatabaseConnection()`
    - Server-Timing headers for browser DevTools integration
    - `withServerlessOptimization()` wrapper for route handlers
    - Cold start metrics collection and aggregation
  - **Route Configuration**:
    - `INFREQUENT_ROUTES`: Routes with low traffic that may experience cold starts
      - `/api/owner/cleanup` (60s timeout) - Cleanup operations
      - `/api/owner/fraud` (30s timeout) - Fraud review
      - `/api/owner/db-indexes` (30s timeout) - Index analysis
      - `/api/owner/cache-warm` (60s timeout) - Cache warming
      - `/api/users/account` (30s timeout) - Account deletion
      - `/api/auth/forgot-password` (10s timeout) - Password reset
      - `/api/auth/reset-password` (10s timeout) - Password reset
      - `/api/reports` (15s timeout) - Player reports
      - `/api/bans/game-id` (15s timeout) - Ban management
      - `/api/revalidate` (10s timeout) - ISR revalidation
    - `FREQUENT_ROUTES`: High-traffic routes kept warm
      - `/api/tournaments` - Tournament listing
      - `/api/registrations/register` - Registration flow
      - `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me` - Auth
  - **Vercel Integration**:
    - All infrequent routes export `maxDuration` for function timeout
    - All routes export `dynamic = "force-dynamic"` to ensure serverless execution
    - Cold start metrics available for Vercel Analytics integration
  - **Monitoring Endpoint** (`/api/owner/serverless-stats`):
    - GET: Instance stats (uptime, request count, cold start status)
    - Cold start metrics (total, avg duration, by route, recent list)
    - Route configuration summary
    - Automated recommendations based on metrics
  - **Cold Start Optimization Techniques Applied**:
    - Lazy imports for heavy dependencies (Socket.IO already lazy-loaded)
    - Database connection pooling with warm-up queries
    - Server-timing headers for debugging
    - Phase-level performance timing
  - **Files**:
    - `src/lib/serverless.ts` - Core serverless optimization library
    - `api/owner/serverless-stats/route.ts` - Monitoring endpoint
    - Updated routes: `cleanup`, `fraud`, `db-indexes`, `cache-warm`, `account`, `forgot-password`, `reset-password`, `reports`, `game-id`, `revalidate`

### 4.6 Monitoring (Week 15)
- [x] **Monitoring dashboards for resource usage** ✅
  - Set up monitoring (Vercel Analytics, etc.)
  - Create custom dashboards
  - Track key metrics
  - **Implementation**:
    - **Unified Monitoring API** (`/api/owner/monitoring`):
      - Aggregates all system metrics in a single endpoint
      - Health scoring system (0-100) with status: healthy/degraded/critical
      - Issue detection for: DB pool >80%, Redis not connected, failed emails, high cold starts
      - 60-second cache TTL, `?fresh=true` to bypass cache
      - Collects: database pool/performance/storage, Redis cache, serverless stats, email queue, media storage, platform stats, cleanup status
    - **Visual Dashboard** (`/owner/monitoring`):
      - Health status banner with color-coded status (green/yellow/red)
      - Platform stats cards (users, tournaments, registrations, DB size)
      - Metric sections: Database Pool, Redis Cache, Serverless Performance, Email Queue, Media Storage, Cleanup Status
      - Progress bars for utilization metrics
      - Auto-refresh toggle (30-second interval)
      - Time formatting utilities for durations and relative times
    - **Vercel Analytics Integration**:
      - Installed `@vercel/analytics` and `@vercel/speed-insights` packages
      - Added `<Analytics />` and `<SpeedInsights />` components to root layout
      - Automatic Core Web Vitals tracking
      - Real User Monitoring (RUM) in production
    - **Redis Monitoring Helpers**:
      - Added `isRedisConnected()` export to check connection status
      - Added `getRedisInfo()` export returning memory usage, hit rate, key count
  - **Files**:
    - `src/app/api/owner/monitoring/route.ts` - Unified monitoring API
    - `src/app/(dashboard)/owner/monitoring/page.tsx` - Visual dashboard
    - `src/lib/redis.ts` - Added monitoring helper exports
    - `src/app/layout.tsx` - Added Analytics and SpeedInsights components

- [ ] **Cost alerts for cloud service usage**
  - Set up billing alerts
  - Monitor Cloudinary usage
  - Track database size

- [ ] **Auto-scaling configuration for traffic spikes**
  - Configure auto-scaling rules
  - Load test the platform
  - Set up alerts for scaling events

---

## 💰 Phase 5: Monetization (Priority: Medium)

> **Goal:** Implement revenue-generating features

### 5.1 Entry Fees & Payments (Week 16-17)
- [ ] **Tournament entry fees with platform commission (5-15%)**
  - Integrate payment gateway (Razorpay/Stripe)
  - Implement commission calculation
  - Create payout system for organizers

- [ ] **Prize pool tracker and distribution system**
  - Track entry fee contributions
  - Calculate prize splits
  - Generate payout reports

### 5.2 Premium Features (Week 17-18)
- [ ] **Featured tournament placement fees**
  - Create featured slot system
  - Design featured tournament UI
  - Implement payment flow

- [ ] **Premium player profiles with verified badges**
  - Define premium tier benefits
  - Create subscription system
  - Implement premium profile features

- [ ] **Custom branding packages for organizers**
  - Allow custom colors/logos
  - White-label tournament pages
  - Package pricing tiers

- [ ] **Priority customer support tiers**
  - Create support ticket system
  - Implement priority queues
  - Track response times

### 5.3 Advertising (Week 18-19) ✅ (Implemented January 2025)
- [x] **Advertisement slots (banner, video ads between registrations)**
  - Database schema: `ad_placements`, `advertisements`, `ad_impressions`, `ad_clicks`, `ad_daily_stats` tables
  - 9 predefined placements: dashboard_top, dashboard_sidebar, tournament_list_top, tournament_detail_sidebar, registration_interstitial, registration_success, leaderboard_sidebar, mobile_bottom, video_preroll
  - Ad types: banner, video, native, interstitial
  - Pricing models: CPM, CPC, CPA, flat rate
  - Files: `migrations/create_advertisements.sql`, `src/lib/ads.ts`

- [x] **Public ad serving API**
  - GET /api/ads - Fetch eligible ads by placement with random rotation
  - POST /api/ads - Track impressions (viewability) and clicks
  - Fraud detection: fast clicks (<100ms), duplicate clicks
  - Session-based tracking with impression tokens
  - File: `src/app/api/ads/route.ts`

- [x] **Ad components for frontend integration**
  - `AdPlacement` - Main component with IntersectionObserver for 50% viewability tracking
  - `InterstitialAd` - Full-screen overlay with configurable skip delay
  - Automatic impression recording on view
  - Click tracking with time-to-click measurement
  - Files: `src/components/ads/AdPlacement.tsx`, `src/components/ads/InterstitialAd.tsx`

- [x] **Owner ad management dashboard**
  - List all ads with summary stats (active/draft/paused, impressions, clicks, CTR, revenue)
  - Create new advertisements with targeting, scheduling, budgets
  - Individual ad detail view with daily stats, placement breakdown, fraud analysis
  - Activate, pause, delete ads
  - Files: `src/app/api/owner/ads/route.ts`, `src/app/api/owner/ads/[id]/route.ts`
  - UI: `src/app/(dashboard)/owner/ads/page.tsx`, `src/app/(dashboard)/owner/ads/[id]/page.tsx`

- [x] **Ad integration in pages**
  - Dashboard top banner ad
  - Leaderboard sidebar ad
  - Registration flow with interstitial ad on success
  - Files updated: `dashboard/page.tsx`, `leaderboard/page.tsx`, `register-tournament/[id]/page.tsx`

- [ ] **Sponsored tournament packages for brands**
  - Create sponsorship tiers
  - Implement sponsor branding
  - Track sponsor metrics

### 5.4 Affiliate Program (Week 19)
- [ ] **Affiliate commission program for influencer promotion**
  - Generate unique referral codes
  - Track referral conversions
  - Calculate and display commissions
  - Implement payout system

---

## 🚀 Phase 6: Advanced Features (Ongoing)

> **Goal:** Continuous improvement and advanced capabilities

### 6.1 Future Enhancements
- [ ] **Live streaming integration**
- [ ] **Voice chat integration**
- [ ] **AI-powered matchmaking**
- [ ] **Mobile app (React Native)**
- [ ] **API for third-party integrations**
- [ ] **Tournament analytics dashboard**
- [ ] **Multi-language support**
- [ ] **Regional server selection**

---

## 📊 Progress Tracking

### Completed Features ✅
- Basic authentication (JWT, bcrypt)
- Tournament CRUD operations
- Team registration system
- Room ID/Password distribution
- Push notifications
- Socket.IO setup
- Basic rate limiting
- CSRF protection
- Mobile responsive design
- Registration caching
- **Advertising system with ad placement, tracking, and management (Phase 5.3)**

### In Progress 🔄
- (Track current work here)

### Blocked ❌
- (Track blockers here)

---

## 📝 Implementation Notes

### Before Starting Each Feature:
1. Review related existing code
2. Design database schema changes
3. Create API endpoint specifications
4. Design UI mockups if needed
5. Write test cases

### After Completing Each Feature:
1. Test thoroughly
2. Update documentation
3. Check for TypeScript errors
4. Verify mobile responsiveness
5. Update this roadmap

### Dependencies to Install (As Needed):
```bash
# Phase 1 - Security
npm install speakeasy qrcode  # For 2FA
npm install dompurify         # For XSS protection

# Phase 4 - Optimization
npm install redis ioredis     # For caching

# Phase 5 - Monetization
npm install razorpay          # For payments (India)
# or
npm install stripe            # For payments (Global)
```

---

## 🔗 Related Documentation

- [CHAT_FEATURE.md](./CHAT_FEATURE.md) - Chat implementation details
- [TOURNAMENT_AUTO_SCHEDULING.md](./TOURNAMENT_AUTO_SCHEDULING.md) - Auto-scheduling system
- [IMPROVEMENTS_AND_FEATURES.md](./IMPROVEMENTS_AND_FEATURES.md) - Previous improvements

---

> **Last Updated:** December 30, 2025  
> **Next Review:** After Phase 1 completion
