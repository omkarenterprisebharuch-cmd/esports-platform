import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";
import crypto from "crypto";
import { UserRole } from "@/types";

// SECURITY: JWT_SECRET must be set in environment - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. This is required for production security.");
}

// CSRF token secret for generating tokens
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString("hex");

// Token expiration times
export const ACCESS_TOKEN_EXPIRY = "15m";  // 15 minutes
export const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days (default)
export const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// "Remember me" extended session (30 days)
export const REMEMBER_ME_EXPIRY_DAYS = 30;
export const REMEMBER_ME_EXPIRY_MS = REMEMBER_ME_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Idle timeout (30 minutes) - for frontend session management
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface TokenPayload {
  id: string; // UUID
  email: string;
  username: string;
  is_host: boolean;
  role: UserRole; // RBAC role
  email_verified: boolean; // Whether email has been verified
}

export interface RefreshTokenPayload {
  id: string; // UUID - user id
  tokenId: string; // UUID - refresh token id for revocation
  type: "refresh";
}

// ============ Role-based Access Control ============

/**
 * Permission matrix for RBAC
 */
export const ROLE_PERMISSIONS = {
  player: ["view_tournaments", "register_tournament", "manage_profile", "view_teams"],
  organizer: ["view_tournaments", "register_tournament", "manage_profile", "view_teams", "create_tournament", "manage_own_tournaments", "view_registrations"],
  owner: ["view_tournaments", "register_tournament", "manage_profile", "view_teams", "create_tournament", "manage_own_tournaments", "view_registrations", "manage_all_users", "assign_roles", "view_all_tournaments", "platform_settings", "view_analytics"],
} as const;

export type Permission = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS][number];

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission as never) || false;
}

/**
 * Check if user has organizer or owner role
 */
export function isOrganizer(role: UserRole): boolean {
  return role === "organizer" || role === "owner";
}

/**
 * Check if user is platform owner
 */
export function isOwner(role: UserRole): boolean {
  return role === "owner";
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare password with hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============ Access Token Functions ============

/**
 * Generate short-lived access token (15 minutes)
 */
export function generateAccessToken(user: {
  id: string;
  email: string;
  username: string;
  is_host?: boolean;
  role?: UserRole;
  email_verified?: boolean;
}): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      is_host: user.is_host || false,
      role: user.role || "player",
      email_verified: user.email_verified ?? false,
    },
    JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate JWT token (legacy - uses access token internally)
 * @deprecated Use generateAccessToken instead
 */
export function generateToken(user: {
  id: string | number;
  email: string;
  username: string;
  is_host?: boolean;
  role?: UserRole;
}): string {
  return generateAccessToken({
    id: String(user.id),
    email: user.email,
    username: user.username,
    is_host: user.is_host,
    role: user.role,
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload & TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify JWT token (legacy - uses verifyAccessToken internally)
 */
export function verifyToken(token: string): TokenPayload | null {
  return verifyAccessToken(token);
}

// ============ Refresh Token Functions ============

/**
 * Generate a cryptographically secure refresh token
 * Returns: { token: raw token to send to client, hash: hash to store in DB }
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Hash a token using SHA-256 (for storing refresh tokens securely)
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate refresh token expiry date
 */
export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}

/**
 * Get current user from cookies (for server components)
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  return verifyToken(token);
}

/**
 * Get user from Authorization header OR httpOnly cookie (for API routes)
 * Priority: Cookie (secure) > Header (for backwards compatibility during migration)
 */
export function getUserFromRequest(
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }
): TokenPayload | null {
  // First try httpOnly cookie (preferred, secure method)
  const cookieToken = request.cookies.get("auth_token")?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  // Fallback to Authorization header (backwards compatibility)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return verifyToken(token);
  }

  return null;
}

/**
 * Get user from Authorization header (for API routes)
 * @deprecated Use getUserFromRequest instead for httpOnly cookie support
 */
export function getUserFromHeader(
  authHeader: string | null
): TokenPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  return verifyToken(token);
}

// ============ CSRF Protection ============

/**
 * Generate a CSRF token for a user session
 */
export function generateCsrfToken(userId: string | number): string {
  const timestamp = Date.now();
  const data = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(data)
    .digest("hex");
  return Buffer.from(`${data}:${signature}`).toString("base64");
}

/**
 * Verify a CSRF token
 * Token is valid for 24 hours
 */
export function verifyCsrfToken(token: string, userId: string | number): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [tokenUserId, timestamp, signature] = decoded.split(":");
    
    // Check user ID matches (compare as strings)
    if (tokenUserId !== String(userId)) {
      return false;
    }

    // Check token age (24 hours max)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return false;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", CSRF_SECRET)
      .update(`${tokenUserId}:${timestamp}`)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============ Role-based Route Protection ============

/**
 * Require a specific role for API route access
 * Returns the user if authorized, null if not
 */
export function requireRole(
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } },
  requiredRoles: UserRole[]
): TokenPayload | null {
  const user = getUserFromRequest(request);
  if (!user) return null;
  
  // Check if user's role is in the required roles
  // Default to 'player' if no role in token (backwards compatibility)
  const userRole = user.role || "player";
  if (!requiredRoles.includes(userRole)) return null;
  
  return user;
}

/**
 * Require organizer or owner role
 */
export function requireOrganizer(
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }
): TokenPayload | null {
  return requireRole(request, ["organizer", "owner"]);
}

/**
 * Require owner role
 */
export function requireOwner(
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }
): TokenPayload | null {
  return requireRole(request, ["owner"]);
}

// ============ Email Verification Protection ============

/**
 * Check if user has verified their email
 */
export function isEmailVerified(user: TokenPayload | null): boolean {
  if (!user) return false;
  // Default to false if email_verified is not in the token (backwards compatibility)
  return user.email_verified ?? false;
}

/**
 * Require email verification for API route access
 * Returns the user if email is verified, null if not authenticated or not verified
 */
export function requireEmailVerified(
  request: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }
): { user: TokenPayload | null; verified: boolean; error?: string } {
  const user = getUserFromRequest(request);
  if (!user) {
    return { user: null, verified: false, error: "Authentication required" };
  }
  
  // Check if email is verified (default to false for backwards compatibility)
  const verified = user.email_verified ?? false;
  if (!verified) {
    return { user, verified: false, error: "Email verification required" };
  }
  
  return { user, verified: true };
}

/**
 * Cookie configuration for access token (short-lived, httpOnly)
 */
export const AUTH_COOKIE_OPTIONS = {
  name: "auth_token",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 15 * 60, // 15 minutes in seconds (matches ACCESS_TOKEN_EXPIRY)
};

/**
 * Cookie configuration for refresh token (long-lived, httpOnly, secure)
 */
export const REFRESH_COOKIE_OPTIONS = {
  name: "refresh_token",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60, // 7 days in seconds
};

/**
 * Cookie configuration for CSRF token (readable by JS)
 */
export const CSRF_COOKIE_OPTIONS = {
  name: "csrf_token",
  httpOnly: false, // Must be readable by JavaScript
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60, // 24 hours in seconds
};
