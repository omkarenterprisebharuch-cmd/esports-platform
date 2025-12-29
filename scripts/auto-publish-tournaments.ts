/**
 * Tournament Auto-Publisher Script
 * 
 * This script checks for scheduled tournament templates and publishes them
 * when their publish_time matches the current time.
 * 
 * Run this script every minute via cron job or task scheduler:
 * 
 * Windows Task Scheduler:
 *   Run: npx ts-node scripts/auto-publish-tournaments.ts
 *   Trigger: Every 1 minute
 * 
 * Linux/Mac Cron (every minute):
 *   * * * * * cd /path/to/project && npx ts-node scripts/auto-publish-tournaments.ts
 * 
 * Or use node-cron in a long-running process (see server integration below)
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function autoPublishTournaments() {
  console.log(`[${new Date().toISOString()}] Running tournament auto-publisher...`);

  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`Current time: ${currentTime}, Today: ${today}`);

    // Find all everyday templates that should be published at this time
    // and haven't been published today yet
    const templatesResult = await pool.query(
      `SELECT * FROM tournaments 
       WHERE schedule_type = 'everyday' 
       AND is_template = TRUE 
       AND publish_time = $1
       AND (last_published_at IS NULL OR DATE(last_published_at) < $2)`,
      [currentTime, today]
    );

    const templates = templatesResult.rows;
    
    if (templates.length === 0) {
      console.log('No tournaments to publish at this time.');
      return;
    }

    console.log(`Found ${templates.length} template(s) to publish.`);

    for (const template of templates) {
      try {
        // Calculate today's dates based on template's time offsets
        const templateRegStart = new Date(template.registration_start_date);
        const templateRegEnd = new Date(template.registration_end_date);
        const templateStart = new Date(template.tournament_start_date);
        const templateEnd = new Date(template.tournament_end_date);

        // Calculate time differences from registration start
        const regEndOffset = templateRegEnd.getTime() - templateRegStart.getTime();
        const startOffset = templateStart.getTime() - templateRegStart.getTime();
        const endOffset = templateEnd.getTime() - templateRegStart.getTime();

        // Create today's dates using publish_time
        const [hours, minutes] = template.publish_time.split(':').map(Number);
        const todayRegStart = new Date(now);
        todayRegStart.setHours(hours, minutes, 0, 0);

        const todayRegEnd = new Date(todayRegStart.getTime() + regEndOffset);
        const todayStart = new Date(todayRegStart.getTime() + startOffset);
        const todayEnd = new Date(todayRegStart.getTime() + endOffset);

        // Create the new tournament from template
        const result = await pool.query(
          `INSERT INTO tournaments (
            host_id,
            tournament_name,
            game_type,
            tournament_type,
            description,
            tournament_banner_url,
            max_teams,
            entry_fee,
            prize_pool,
            match_rules,
            map_name,
            total_matches,
            status,
            registration_start_date,
            registration_end_date,
            tournament_start_date,
            tournament_end_date,
            schedule_type,
            template_id,
            is_template
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING id`,
          [
            template.host_id,
            template.tournament_name,
            template.game_type,
            template.tournament_type,
            template.description,
            template.tournament_banner_url,
            template.max_teams,
            template.entry_fee,
            template.prize_pool,
            template.match_rules,
            template.map_name,
            template.total_matches,
            "upcoming",
            todayRegStart,
            todayRegEnd,
            todayStart,
            todayEnd,
            "once",
            template.id,
            false,
          ]
        );

        // Update the template's last_published_at
        await pool.query(
          `UPDATE tournaments SET last_published_at = NOW() WHERE id = $1`,
          [template.id]
        );

        console.log(`✅ Published tournament "${template.tournament_name}" (ID: ${result.rows[0].id}) from template ${template.id}`);
        console.log(`   Registration: ${todayRegStart.toLocaleString()} - ${todayRegEnd.toLocaleString()}`);
        console.log(`   Tournament: ${todayStart.toLocaleString()} - ${todayEnd.toLocaleString()}`);

      } catch (err) {
        console.error(`❌ Error publishing template ${template.id} (${template.tournament_name}):`, err);
      }
    }

    console.log('Auto-publish completed.');

  } catch (error) {
    console.error('Error in auto-publisher:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
autoPublishTournaments();
