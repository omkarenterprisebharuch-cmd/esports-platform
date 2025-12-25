/**
 * Zod Schemas matching TypeScript types in types/index.ts
 * 
 * These schemas can be used for:
 * 1. Runtime validation of API responses
 * 2. Form validation
 * 3. Type inference (z.infer<typeof schema>)
 */

import { z } from "zod";

// ============ Base Schemas ============

export const uuidSchema = z.string().uuid("Invalid UUID format");
export const dateSchema = z.coerce.date();
export const positiveIntSchema = z.number().int().min(0);
export const emailSchema = z.string().email("Invalid email address").toLowerCase().trim();

// ============ User Schemas ============

export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(50),
  email: emailSchema,
  password_hash: z.string().optional(),
  full_name: z.string().max(100).optional().nullable(),
  phone_number: z.string().max(20).optional().nullable(),
  profile_picture_url: z.string().url().optional().nullable(),
  in_game_ids: z.record(z.string()).optional().nullable(),
  wallet_balance: z.number().default(0),
  is_host: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
  auth_provider: z.enum(["local", "google", "facebook", "discord"]).default("local"),
  auth_provider_id: z.string().optional().nullable(),
  last_login_at: dateSchema.optional().nullable(),
  created_at: dateSchema,
  updated_at: dateSchema,
  avatar_url: z.string().url().optional().nullable(),
});

export const publicUserSchema = userSchema.omit({
  password_hash: true,
  auth_provider_id: true,
});

// ============ Team Schemas ============

export const teamSchema = z.object({
  id: z.number().int(),
  team_name: z.string().min(2).max(50),
  team_code: z.string(),
  invite_code: z.string().optional(),
  captain_id: z.number().int(),
  owner_id: z.number().int().optional(),
  description: z.string().max(500).optional().nullable(),
  total_members: z.number().int().min(1).default(1),
  max_members: z.number().int().min(2).max(10).default(6),
  member_count: z.number().int().optional(),
  is_active: z.boolean().default(true),
  created_at: dateSchema,
  updated_at: dateSchema,
});

export const teamMemberSchema = z.object({
  id: z.number().int(),
  team_id: z.number().int(),
  user_id: z.number().int(),
  role: z.enum(["captain", "member"]),
  game_uid: z.string(),
  game_name: z.string(),
  joined_at: dateSchema,
  left_at: dateSchema.optional().nullable(),
});

export const teamMemberWithUserSchema = teamMemberSchema.extend({
  username: z.string(),
  avatar_url: z.string().url().optional().nullable(),
});

// ============ Tournament Schemas ============

export const gameTypeSchema = z.enum(["freefire", "pubg", "valorant", "codm"]);
export const tournamentTypeSchema = z.enum(["solo", "duo", "squad"]);
export const tournamentStatusSchema = z.enum([
  "upcoming",
  "registration_open",
  "ongoing",
  "completed",
  "cancelled",
]);

export const tournamentSchema = z.object({
  id: z.number().int(),
  host_id: z.number().int(),
  tournament_name: z.string().min(3).max(100),
  game_type: gameTypeSchema,
  tournament_type: tournamentTypeSchema,
  description: z.string().max(2000),
  tournament_banner_url: z.string().url().optional().nullable(),
  max_teams: z.number().int().min(2).max(1000),
  current_teams: z.number().int().default(0),
  entry_fee: z.number().min(0).default(0),
  prize_pool: z.number().min(0).default(0),
  match_rules: z.string().max(5000).optional().nullable(),
  map_name: z.string().max(100).optional().nullable(),
  total_matches: z.number().int().min(1).default(1),
  status: tournamentStatusSchema,
  registration_start_date: dateSchema,
  registration_end_date: dateSchema,
  tournament_start_date: dateSchema,
  tournament_end_date: dateSchema,
  room_id: z.string().max(100).optional().nullable(),
  room_password: z.string().max(100).optional().nullable(),
  room_credentials_updated_at: dateSchema.optional().nullable(),
  created_at: dateSchema,
  updated_at: dateSchema,
});

export const tournamentWithHostSchema = tournamentSchema.extend({
  host_name: z.string(),
  host_avatar: z.string().url().optional().nullable(),
  computed_status: tournamentStatusSchema,
  seconds_to_next_status: z.number().optional(),
  next_status_change: z.string().optional(),
});

// ============ Registration Schemas ============

export const registrationStatusSchema = z.enum([
  "registered",
  "confirmed",
  "cancelled",
  "checked_in",
]);

export const tournamentRegistrationSchema = z.object({
  id: z.number().int(),
  tournament_id: z.number().int(),
  team_id: z.number().int().optional().nullable(),
  user_id: z.number().int(),
  registration_type: z.enum(["solo", "duo", "squad"]),
  slot_number: z.number().int(),
  selected_players: z.array(z.number().int()).optional().nullable(),
  backup_players: z.array(z.number().int()).optional().nullable(),
  status: registrationStatusSchema,
  registered_at: dateSchema,
});

// ============ Match Schemas ============

export const matchStatusSchema = z.enum([
  "pending",
  "scheduled",
  "ongoing",
  "completed",
]);

export const matchSchema = z.object({
  id: z.number().int(),
  tournament_id: z.number().int(),
  match_number: z.number().int(),
  round: z.number().int(),
  team1_id: z.number().int().optional().nullable(),
  team2_id: z.number().int().optional().nullable(),
  winner_id: z.number().int().optional().nullable(),
  scheduled_at: dateSchema.optional().nullable(),
  status: matchStatusSchema,
});

export const matchResultSchema = z.object({
  id: z.number().int(),
  match_id: z.number().int(),
  team_id: z.number().int(),
  kills: z.number().int().min(0).default(0),
  placement: z.number().int().min(1),
  points: z.number().int().default(0),
  submitted_by: z.number().int(),
  verified: z.boolean().default(false),
});

// ============ Notification Schemas ============

export const notificationTypeSchema = z.enum([
  "info",
  "success",
  "warning",
  "error",
]);

export const notificationSchema = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  title: z.string().max(100),
  message: z.string().max(500),
  type: notificationTypeSchema,
  is_read: z.boolean().default(false),
  created_at: dateSchema,
});

// ============ Transaction Schemas ============

export const transactionTypeSchema = z.enum([
  "deposit",
  "withdrawal",
  "entry_fee",
  "prize",
  "refund",
]);

export const transactionStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
]);

export const transactionSchema = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  amount: z.number(),
  type: transactionTypeSchema,
  status: transactionStatusSchema,
  description: z.string().optional().nullable(),
  reference_id: z.string().optional().nullable(),
  created_at: dateSchema,
});

// ============ Chat Schemas ============

export const chatMessageSchema = z.object({
  id: z.number().int(),
  tournament_id: z.number().int(),
  user_id: z.number().int(),
  message: z.string().min(1).max(1000),
  created_at: dateSchema,
});

export const chatMessageWithUserSchema = chatMessageSchema.extend({
  username: z.string(),
  avatar_url: z.string().url().optional().nullable(),
});

// ============ Leaderboard Schemas ============

export const tournamentLeaderboardSchema = z.object({
  id: z.number().int(),
  tournament_id: z.number().int(),
  team_id: z.number().int().optional().nullable(),
  user_id: z.number().int().optional().nullable(),
  rank: z.number().int().min(1),
  kills: z.number().int().min(0).optional().nullable(),
  points: z.number().int().optional().nullable(),
  prize_amount: z.number().min(0).optional().nullable(),
  updated_at: dateSchema,
  updated_by: z.number().int(),
});

export const leaderboardEntrySchema = tournamentLeaderboardSchema.extend({
  team_name: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
});

// ============ Dispute Schemas ============

export const disputeStatusSchema = z.enum([
  "pending",
  "investigating",
  "resolved",
  "rejected",
]);

export const disputeSchema = z.object({
  id: z.number().int(),
  match_id: z.number().int(),
  submitted_by: z.number().int(),
  reason: z.string().min(10).max(1000),
  evidence_url: z.string().url().optional().nullable(),
  status: disputeStatusSchema,
  resolution: z.string().optional().nullable(),
  resolved_by: z.number().int().optional().nullable(),
  created_at: dateSchema,
  resolved_at: dateSchema.optional().nullable(),
});

// ============ API Response Schemas ============

export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });
}

// ============ Type Exports ============

export type UserSchema = z.infer<typeof userSchema>;
export type PublicUserSchema = z.infer<typeof publicUserSchema>;
export type TeamSchema = z.infer<typeof teamSchema>;
export type TeamMemberSchema = z.infer<typeof teamMemberSchema>;
export type TournamentSchema = z.infer<typeof tournamentSchema>;
export type TournamentWithHostSchema = z.infer<typeof tournamentWithHostSchema>;
export type TournamentRegistrationSchema = z.infer<typeof tournamentRegistrationSchema>;
export type MatchSchema = z.infer<typeof matchSchema>;
export type MatchResultSchema = z.infer<typeof matchResultSchema>;
export type NotificationSchema = z.infer<typeof notificationSchema>;
export type TransactionSchema = z.infer<typeof transactionSchema>;
export type ChatMessageSchema = z.infer<typeof chatMessageSchema>;
export type TournamentLeaderboardSchema = z.infer<typeof tournamentLeaderboardSchema>;
export type LeaderboardEntrySchema = z.infer<typeof leaderboardEntrySchema>;
export type DisputeSchema = z.infer<typeof disputeSchema>;
