/**
 * Tournament Scheduler Module
 * 
 * Handles automatic publishing of scheduled recurring tournaments.
 * Runs every minute to check for tournaments that need to be published.
 */

import pool from "./db";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Check and publish scheduled tournaments
 */
async function checkAndPublishTournaments() {
  if (isRunning) {
    console.log("[Scheduler] Previous run still in progress, skipping...");
    return;
  }

  isRunning = true;

  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD format

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
      return;
    }

    console.log(
      `[Scheduler] Found ${templates.length} template(s) to publish at ${currentTime}`
    );

    for (const template of templates) {
      try {
        await publishFromTemplate(template, now);
      } catch (err) {
        console.error(
          `[Scheduler] Error publishing template ${template.id}:`,
          err
        );
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error checking templates:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Create a new tournament from a template
 */
async function publishFromTemplate(template: Record<string, unknown>, now: Date) {
  // Calculate today's dates based on template's time offsets
  const templateRegStart = new Date(template.registration_start_date as string);
  const templateRegEnd = new Date(template.registration_end_date as string);
  const templateStart = new Date(template.tournament_start_date as string);
  const templateEnd = new Date(template.tournament_end_date as string);

  // Calculate time differences from registration start
  const regEndOffset = templateRegEnd.getTime() - templateRegStart.getTime();
  const startOffset = templateStart.getTime() - templateRegStart.getTime();
  const endOffset = templateEnd.getTime() - templateRegStart.getTime();

  // Create today's dates using publish_time
  const publishTime = template.publish_time as string;
  const [hours, minutes] = publishTime.split(":").map(Number);
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

  console.log(
    `[Scheduler] ✅ Published "${template.tournament_name}" (ID: ${result.rows[0].id}) from template ${template.id}`
  );
  console.log(
    `[Scheduler]    Registration: ${todayRegStart.toLocaleTimeString()} - ${todayRegEnd.toLocaleTimeString()}`
  );
  console.log(
    `[Scheduler]    Tournament: ${todayStart.toLocaleTimeString()} - ${todayEnd.toLocaleTimeString()}`
  );

  return result.rows[0];
}

/**
 * Start the tournament scheduler
 * Runs every minute to check for tournaments to publish
 */
export function startTournamentScheduler() {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }

  console.log("[Scheduler] Starting tournament auto-publisher...");

  // Run immediately on startup
  checkAndPublishTournaments();

  // Then run every minute
  schedulerInterval = setInterval(checkAndPublishTournaments, 60 * 1000);

  console.log("[Scheduler] Tournament scheduler started (checking every minute)");
}

/**
 * Stop the tournament scheduler
 */
export function stopTournamentScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Tournament scheduler stopped");
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
