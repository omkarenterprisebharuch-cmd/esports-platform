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

- [ ] **GDPR-compliant data handling**
  - Add data export functionality
  - Implement account deletion
  - Create privacy policy acceptance tracking

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

- [ ] **Tournament discovery with filters (game, prize pool, date, region)**
  - Add region/location field to tournaments
  - Implement advanced filter UI
  - Add sorting options (prize, date, popularity)

- [ ] **Personalized tournament recommendations**
  - Track user's game preferences
  - Recommend based on registration history
  - Show "Tournaments you might like" section

- [ ] **Tournament waitlist system**
  - Add waitlist when tournament is full
  - Auto-promote when spot opens
  - Send notification on promotion

### 2.2 Notifications & Reminders (Week 4-5)
- [ ] **Email and push notifications for tournament updates** ✅ (Push implemented)
  - Expand email notifications
  - Add notification preferences settings
  - Implement notification center UI

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

### 2.4 Social Features (Week 6)
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

- [ ] **Dark/light theme toggle**
  - Implement theme context
  - Add toggle in header/settings
  - Persist preference in localStorage

- [ ] **PWA for app-like experience**
  - Create manifest.json ✅ (Partially done)
  - Implement offline support
  - Add install prompt
  - Enable background sync

---

## 🏆 Phase 3: Competitive Tournament Features (Priority: High)

> **Goal:** Build robust tournament management system

### 3.1 Tournament Creation (Week 7-8)
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

### 3.4 Check-in & Attendance (Week 11)
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

- [ ] **Winner announcement and hall of fame**
  - Create hall of fame page
  - Auto-post winners after tournament
  - Add winner badges to profiles

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

- [ ] **Cross-platform tournament support (PC/Mobile)**
  - Add platform field to tournaments
  - Filter by platform
  - Platform-specific rules

- [ ] **Tournament result dispute resolution system**
  - Create dispute submission form
  - Admin dispute review queue
  - Resolution tracking

- [ ] **Anti-cheating player reporting mechanism**
  - In-match report button
  - Report review system
  - Player ban management

---

## ⚡ Phase 4: Cost Optimization (Priority: High)

> **Goal:** Optimize for scale and reduce operational costs

### 4.1 Frontend Optimization (Week 13)
- [ ] **Code splitting and lazy loading** ✅ (Partially implemented)
  - Audit all dynamic imports
  - Lazy load non-critical components
  - Measure bundle size improvements

- [ ] **Bundle size analysis and optimization**
  - Set up bundle analyzer
  - Identify large dependencies
  - Replace/remove bloated packages

- [ ] **Tree shaking for unused code removal**
  - Ensure ES modules usage
  - Audit for side effects
  - Verify tree shaking effectiveness

- [ ] **Image optimization via Cloudinary with compression** ✅ (Implemented)
  - Add auto-format transformation
  - Implement responsive images
  - Set quality optimization

- [ ] **Cloudinary auto-format and quality optimization**
  - Use f_auto,q_auto parameters
  - Implement blur placeholders
  - Lazy load below-fold images

### 4.2 Backend Optimization (Week 13-14)
- [ ] **Database connection pooling (PostgreSQL)** ✅ (Using pg pool)
  - Verify pool configuration
  - Monitor connection usage
  - Tune pool size

- [ ] **Database query optimization with indexes** ✅ (Partially implemented)
  - Analyze slow queries
  - Add missing indexes
  - Review query plans

- [ ] **Pagination for large data sets** ✅ (Implemented)
  - Verify all list endpoints paginated
  - Implement cursor-based pagination for real-time data
  - Add page size limits

- [ ] **API response caching with Redis**
  - Set up Redis instance
  - Cache tournament listings
  - Implement cache invalidation

- [ ] **Database query result caching**
  - Cache frequently accessed data
  - Set appropriate TTLs
  - Implement cache warming

- [ ] **Compressed API responses (gzip/brotli)**
  - Enable compression in Next.js
  - Verify compression on responses
  - Measure bandwidth savings

### 4.3 Static Generation (Week 14)
- [ ] **Next.js static page generation for public pages**
  - Identify static-friendly pages
  - Implement getStaticProps where applicable
  - Set up revalidation

- [ ] **Incremental static regeneration (ISR) for tournament pages**
  - Enable ISR for tournament detail pages
  - Set revalidation period
  - Handle on-demand revalidation

- [ ] **Server-side rendering only for dynamic content**
  - Audit SSR usage
  - Convert static-friendly pages
  - Measure performance improvements

- [ ] **CDN integration for static assets**
  - Configure CDN headers
  - Set up asset caching
  - Verify cache hit rates

### 4.4 Real-time Optimization (Week 14-15)
- [ ] **Efficient socket connection management** ✅ (Implemented)
  - Implement connection pooling
  - Add reconnection strategies
  - Monitor connection count

- [ ] **WebSocket event throttling**
  - Throttle high-frequency events
  - Batch updates where possible
  - Implement backpressure handling

### 4.5 Maintenance & Cleanup (Week 15)
- [ ] **Resource cleanup for completed tournaments**
  - Archive completed tournament data
  - Clean up unused media
  - Remove stale sessions

- [ ] **Archival system for old tournament data**
  - Define archival policy
  - Implement archive tables
  - Build archive restoration

- [ ] **Scheduled cleanup jobs for expired data**
  - Clean expired OTPs
  - Remove old logs
  - Prune inactive sessions

- [ ] **Efficient email queuing with batching**
  - Implement email queue
  - Batch similar notifications
  - Rate limit outgoing emails

- [ ] **Serverless API routes for infrequent operations**
  - Identify infrequent endpoints
  - Convert to serverless
  - Monitor cold starts

### 4.6 Monitoring (Week 15)
- [ ] **Monitoring dashboards for resource usage**
  - Set up monitoring (Vercel Analytics, etc.)
  - Create custom dashboards
  - Track key metrics

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

### 5.3 Advertising (Week 18-19)
- [ ] **Advertisement slots (banner, video ads between registrations)**
  - Design ad placement areas
  - Integrate ad network or direct sales
  - Track impressions/clicks

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
