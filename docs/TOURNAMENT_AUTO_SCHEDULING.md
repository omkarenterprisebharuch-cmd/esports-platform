# Tournament Auto-Scheduling Feature

This feature allows admins/hosts to create recurring tournaments that automatically publish at a specified time every day.

## Overview

When creating a tournament, admins/hosts can choose between two scheduling options:

1. **Once** - One-time tournament for a specific date
2. **Everyday** - Recurring daily tournament that auto-publishes at the specified time

## How It Works

### Creating a Scheduled Tournament

1. Go to **Admin Panel** → **Create Tournament**
2. Fill in the tournament details (name, game, entry fee, etc.)
3. Set the schedule dates (these serve as a template):
   - Registration Start/End
   - Tournament Start/End
4. In the **Auto-Scheduling** section:
   - Select **Everyday** for recurring tournaments
   - Set the **Publish Time** (e.g., 10:00 AM)
5. Click **Create Tournament**

### What Happens Next

- The tournament is saved as a **template** (not visible to users)
- Every day at the specified publish time, the system automatically:
  1. Creates a new tournament from the template
  2. Adjusts dates to today (registration starts at publish time)
  3. Publishes it on the website
  4. Users can see and register for the tournament

### Managing Scheduled Tournaments

- Go to **Admin Panel** → **🗓️ Scheduled** tab
- View all your recurring tournament templates
- See when each was last published
- Delete templates to stop auto-publishing

## Technical Details

### Database Schema

New columns added to `tournaments` table:

| Column | Type | Description |
|--------|------|-------------|
| `schedule_type` | VARCHAR(20) | 'once' or 'everyday' |
| `publish_time` | TIME | HH:MM format for daily publishing |
| `is_template` | BOOLEAN | True for template tournaments |
| `template_id` | INTEGER | Reference to parent template |
| `last_published_at` | TIMESTAMP | Last auto-publish time |

### Running the Migration

```sql
-- Run this migration to add scheduling support
\i migrations/add_tournament_scheduling.sql
```

### Scheduler Integration

The scheduler runs automatically when you start the server with:

```bash
npm run server
```

It checks every minute for templates that need to be published.

### API Endpoints

#### Create Tournament (with scheduling)

```http
POST /api/tournaments
Content-Type: application/json

{
  "tournament_name": "Daily Free Fire Battle",
  "game_type": "freefire",
  "tournament_type": "squad",
  "entry_fee": 10,
  "prize_pool": 100,
  "description": "Daily tournament",
  "registration_start_date": "2024-01-01T10:00:00",
  "registration_end_date": "2024-01-01T12:00:00",
  "tournament_start_date": "2024-01-01T14:00:00",
  "tournament_end_date": "2024-01-01T16:00:00",
  "schedule_type": "everyday",
  "publish_time": "10:00"
}
```

#### Get Scheduled Templates

```http
GET /api/tournaments?hosted=true&templates=true
Authorization: Bearer <token>
```

#### Manual Trigger (for cron jobs)

```http
POST /api/tournaments/scheduler/publish
Authorization: Bearer <scheduler-secret>
```

### Running as a Cron Job (Alternative)

If you prefer external scheduling, use the standalone script:

```bash
# Windows Task Scheduler (every minute)
npx ts-node scripts/auto-publish-tournaments.ts

# Linux/Mac Cron
* * * * * cd /path/to/project && npx ts-node scripts/auto-publish-tournaments.ts
```

## Example Use Cases

### Morning Tournament

- **Publish Time**: 10:00 AM
- **Registration**: 10:00 AM - 12:00 PM
- **Tournament**: 2:00 PM - 4:00 PM

Every day at 10:00 AM, a new tournament is created and users can register until noon. The match starts at 2:00 PM.

### Evening Battle

- **Publish Time**: 6:00 PM
- **Registration**: 6:00 PM - 8:00 PM
- **Tournament**: 9:00 PM - 11:00 PM

Every day at 6:00 PM, the tournament goes live for evening players.

## Environment Variables

Add to your `.env.local`:

```env
# Secret key for scheduler API authentication
SCHEDULER_SECRET=your-secure-secret-key
```
