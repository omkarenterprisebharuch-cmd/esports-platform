// Database types matching your PostgreSQL schema

export interface User {
  id: string; // UUID
  username: string;
  email: string;
  password_hash?: string;
  full_name?: string;
  phone_number?: string;
  profile_picture_url?: string;
  in_game_ids?: Record<string, string>;
  wallet_balance: number;
  is_host: boolean;
  is_verified: boolean;
  is_active: boolean;
  auth_provider: "local" | "google" | "facebook" | "discord";
  auth_provider_id?: string;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
  // Frontend compatibility alias
  avatar_url?: string;
}

export interface Team {
  id: number;
  team_name: string;
  team_code: string;
  invite_code?: string; // Alias for team_code
  captain_id: number;
  owner_id?: number; // Alias for captain_id
  description?: string;
  total_members: number;
  max_members: number;
  member_count?: number; // Added for registration eligibility check
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: "captain" | "member";
  game_uid: string;
  game_name: string;
  joined_at: Date;
  left_at?: Date;
}

export interface TeamMemberWithUser extends TeamMember {
  username: string;
  avatar_url?: string;
}

export interface Tournament {
  id: number;
  host_id: number;
  tournament_name: string;
  game_type: "freefire" | "pubg" | "valorant" | "codm";
  tournament_type: "solo" | "duo" | "squad";
  description: string;
  tournament_banner_url?: string;
  max_teams: number;
  current_teams: number;
  entry_fee: number;
  prize_pool: number;
  match_rules?: string;
  map_name?: string;
  total_matches: number;
  status: TournamentStatus;
  registration_start_date: Date;
  registration_end_date: Date;
  tournament_start_date: Date;
  tournament_end_date: Date;
  room_id?: string;
  room_password?: string;
  room_credentials_updated_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export type TournamentStatus =
  | "upcoming"
  | "registration_open"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface TournamentWithHost extends Tournament {
  host_name: string;
  computed_status: TournamentStatus;
  seconds_to_next_status: number;
  next_status_change: string;
}

export interface TournamentRegistration {
  id: number;
  tournament_id: number;
  team_id?: number;
  user_id: number;
  registration_type: "solo" | "duo" | "squad";
  slot_number: number;
  selected_players?: number[];
  backup_players?: number[];
  status: "registered" | "confirmed" | "cancelled" | "checked_in";
  registered_at: Date;
}

export interface Match {
  id: number;
  tournament_id: number;
  match_number: number;
  round: number;
  team1_id?: number;
  team2_id?: number;
  winner_id?: number;
  scheduled_at?: Date;
  status: "pending" | "scheduled" | "ongoing" | "completed";
}

export interface MatchResult {
  id: number;
  match_id: number;
  team_id: number;
  kills: number;
  placement: number;
  points: number;
  submitted_by: number;
  verified: boolean;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: Date;
}

export interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: "deposit" | "withdrawal" | "entry_fee" | "prize" | "refund";
  status: "pending" | "completed" | "failed";
  description?: string;
  reference_id?: string;
  created_at: Date;
}

export interface Dispute {
  id: number;
  match_id: number;
  submitted_by: number;
  reason: string;
  evidence_url?: string;
  status: "pending" | "investigating" | "resolved" | "rejected";
  resolution?: string;
  resolved_by?: number;
  created_at: Date;
  resolved_at?: Date;
}

export interface ChatMessage {
  id: number;
  tournament_id: number;
  user_id: number;
  message: string;
  created_at: Date;
}

// Leaderboard types
export interface TournamentLeaderboard {
  id: number;
  tournament_id: number;
  team_id?: number;
  user_id?: number;
  rank: number;
  kills?: number;
  points?: number;
  prize_amount?: number;
  updated_at: Date;
  updated_by: number;
}

export interface LeaderboardEntry extends TournamentLeaderboard {
  team_name?: string;
  username?: string;
  avatar_url?: string;
}

// Extended types
export interface TournamentWithHost extends Tournament {
  host_name: string;
  host_avatar?: string;
}