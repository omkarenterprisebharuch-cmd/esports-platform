// OTP Generation and Database Storage Utility
// Using PostgreSQL for persistent storage across serverless function invocations

import pool from "./db";

interface OTPRow {
  id: number;
  email: string;
  otp_code: string;
  attempts: number;
  expires_at: Date;
}

/**
 * Generate a random 6-digit alphanumeric OTP
 */
export function generateOTP(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
}

/**
 * Store OTP for email with expiration (in database)
 */
export async function storeOTP(
  email: string,
  otp: string,
  expiresInMinutes: number = 10
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  // Upsert: insert or update if email already exists
  await pool.query(
    `INSERT INTO otp_codes (email, otp_code, attempts, expires_at)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (email) 
     DO UPDATE SET otp_code = $2, attempts = 0, expires_at = $3, created_at = NOW()`,
    [normalizedEmail, otp, expiresAt]
  );
}

/**
 * Verify OTP for email (using database)
 */
export async function verifyOTP(
  email: string,
  otp: string
): Promise<{ valid: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase();
  
  // Get the stored OTP
  const result = await pool.query<OTPRow>(
    `SELECT * FROM otp_codes WHERE email = $1`,
    [normalizedEmail]
  );
  
  const stored = result.rows[0];

  if (!stored) {
    return {
      valid: false,
      message: "OTP not found or expired. Please request a new OTP.",
    };
  }

  // Check if expired
  if (new Date() > new Date(stored.expires_at)) {
    // Delete expired OTP
    await pool.query(`DELETE FROM otp_codes WHERE email = $1`, [normalizedEmail]);
    return { valid: false, message: "OTP has expired. Please request a new OTP." };
  }

  // Check attempts
  if (stored.attempts >= 3) {
    // Delete after too many attempts
    await pool.query(`DELETE FROM otp_codes WHERE email = $1`, [normalizedEmail]);
    return {
      valid: false,
      message: "Too many failed attempts. Please request a new OTP.",
    };
  }

  // Verify OTP (case-insensitive)
  if (stored.otp_code !== otp.toUpperCase()) {
    // Increment attempts
    await pool.query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE email = $1`,
      [normalizedEmail]
    );
    const remainingAttempts = 3 - (stored.attempts + 1);
    return {
      valid: false,
      message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
    };
  }

  // OTP is valid - remove it from storage
  await pool.query(`DELETE FROM otp_codes WHERE email = $1`, [normalizedEmail]);
  return { valid: true, message: "OTP verified successfully." };
}

/**
 * Check if email has a pending OTP (using database)
 */
export async function hasPendingOTP(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();
  
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM otp_codes WHERE email = $1 AND expires_at > NOW()`,
    [normalizedEmail]
  );
  
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Cleanup expired OTPs (can be called periodically)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM otp_codes WHERE expires_at < NOW()`
  );
  return result.rowCount || 0;
}
