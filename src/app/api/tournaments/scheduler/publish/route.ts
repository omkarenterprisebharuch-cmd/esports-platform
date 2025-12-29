import { NextRequest } from "next/server";
import pool from "@/lib/db";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/tournaments/scheduler/publish
 * Auto-publish scheduled tournaments that are due
 * This endpoint should be called by a cron job or scheduled task
 * 
 * Security: Uses a secret key for authentication (for cron jobs)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the scheduler secret key
    const authHeader = request.headers.get("authorization");
    const schedulerSecret = process.env.SCHEDULER_SECRET || "scheduler-secret-key";
    
    if (authHeader !== `Bearer ${schedulerSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

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
    const publishedTournaments = [];
    const errors = [];

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
          RETURNING *`,
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
            "once", // Published tournament is always "once"
            template.id, // Reference to the template
            false, // This is not a template
          ]
        );

        // Update the template's last_published_at
        await pool.query(
          `UPDATE tournaments SET last_published_at = NOW() WHERE id = $1`,
          [template.id]
        );

        publishedTournaments.push({
          templateId: template.id,
          templateName: template.tournament_name,
          newTournamentId: result.rows[0].id,
          registrationStart: todayRegStart,
          registrationEnd: todayRegEnd,
          tournamentStart: todayStart,
        });

      } catch (err) {
        console.error(`Error publishing template ${template.id}:`, err);
        errors.push({
          templateId: template.id,
          templateName: template.tournament_name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return successResponse(
      {
        published: publishedTournaments.length,
        tournaments: publishedTournaments,
        errors: errors.length > 0 ? errors : undefined,
      },
      `Auto-published ${publishedTournaments.length} tournament(s)`
    );
  } catch (error) {
    console.error("Scheduler publish error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * GET /api/tournaments/scheduler/publish
 * Get list of templates that are scheduled for today
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the scheduler secret key
    const authHeader = request.headers.get("authorization");
    const schedulerSecret = process.env.SCHEDULER_SECRET || "scheduler-secret-key";
    
    if (authHeader !== `Bearer ${schedulerSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    const result = await pool.query(
      `SELECT 
        id,
        tournament_name,
        game_type,
        tournament_type,
        publish_time,
        last_published_at,
        host_id
       FROM tournaments 
       WHERE schedule_type = 'everyday' 
       AND is_template = TRUE
       ORDER BY publish_time ASC`
    );

    return successResponse({
      templates: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get scheduled templates error:", error);
    return serverErrorResponse(error);
  }
}
