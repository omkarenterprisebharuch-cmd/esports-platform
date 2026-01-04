// Pending Registration Database Storage Utility
// Using PostgreSQL for persistent storage across serverless function invocations

import pool from "./db";

interface PendingRegistration {
  username: string;
  email: string;
  hashedPassword: string;
  createdAt?: number;
  // GDPR consent tracking
  consentIp?: string;
  consentUserAgent?: string;
}

interface PendingRegistrationRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  consent_ip: string | null;
  consent_user_agent: string | null;
  expires_at: Date;
  created_at: Date;
}

/**
 * Store pending registration in database
 */
export async function storePendingRegistration(
  email: string,
  data: Omit<PendingRegistration, 'createdAt'>
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Upsert: insert or update if email already exists
  await pool.query(
    `INSERT INTO pending_registrations (email, username, password_hash, consent_ip, consent_user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) 
     DO UPDATE SET username = $2, password_hash = $3, consent_ip = $4, consent_user_agent = $5, expires_at = $6, created_at = NOW()`,
    [normalizedEmail, data.username, data.hashedPassword, data.consentIp || null, data.consentUserAgent || null, expiresAt]
  );
}

/**
 * Get pending registration from database
 */
export async function getPendingRegistration(email: string): Promise<PendingRegistration | undefined> {
  const normalizedEmail = email.toLowerCase();
  
  const result = await pool.query<PendingRegistrationRow>(
    `SELECT * FROM pending_registrations WHERE email = $1 AND expires_at > NOW()`,
    [normalizedEmail]
  );
  
  const row = result.rows[0];
  
  if (!row) {
    return undefined;
  }
  
  return {
    username: row.username,
    email: row.email,
    hashedPassword: row.password_hash,
    createdAt: new Date(row.created_at).getTime(),
    consentIp: row.consent_ip || undefined,
    consentUserAgent: row.consent_user_agent || undefined,
  };
}

/**
 * Delete pending registration from database
 */
export async function deletePendingRegistration(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await pool.query(`DELETE FROM pending_registrations WHERE email = $1`, [normalizedEmail]);
}

/**
 * Cleanup expired pending registrations
 */
export async function cleanupOldRegistrations(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM pending_registrations WHERE expires_at < NOW()`
  );
  return result.rowCount || 0;
}

// For backwards compatibility - export empty Map (not used anymore)
export const pendingRegistrations = new Map<string, PendingRegistration>();
