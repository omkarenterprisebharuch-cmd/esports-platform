/**
 * Data Encryption Utility
 * 
 * Provides AES-256-GCM encryption for sensitive PII data at rest.
 * Handles encryption of phone numbers, game IDs, and other sensitive information.
 * 
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV (Initialization Vector) per encryption
 * - Authentication tag to prevent tampering
 * - Secure key derivation from environment variable
 * 
 * @module encryption
 */

import crypto from "crypto";

// ============ Constants ============

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes authentication tag
const KEY_LENGTH = 32; // 32 bytes = 256 bits

// Encryption key cache (derived from master key)
let encryptionKeyCache: Buffer | null = null;

// ============ Key Management ============

/**
 * Get or derive the encryption key from the environment variable.
 * Uses PBKDF2 to derive a proper 256-bit key from the master key.
 * 
 * @throws Error if ENCRYPTION_KEY is not set
 * @returns 32-byte encryption key
 */
function getEncryptionKey(): Buffer {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  const masterKey = process.env.ENCRYPTION_KEY;

  if (!masterKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // If the key is already 64 hex characters (32 bytes), use it directly
  if (/^[a-f0-9]{64}$/i.test(masterKey)) {
    encryptionKeyCache = Buffer.from(masterKey, "hex");
    return encryptionKeyCache;
  }

  // Otherwise, derive a key using PBKDF2
  // Use a fixed salt derived from app name for deterministic key derivation
  const salt = crypto.createHash("sha256").update("esports-platform-pii-encryption").digest();
  encryptionKeyCache = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha512");
  
  return encryptionKeyCache;
}

/**
 * Check if encryption is properly configured
 * @returns true if encryption key is set
 */
export function isEncryptionEnabled(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}

/**
 * Generate a new random encryption key (for initial setup)
 * @returns 64-character hex string suitable for ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

// ============ Encryption Functions ============

/**
 * Encrypt a string value using AES-256-GCM
 * 
 * Format of encrypted data: iv:authTag:encryptedData (all base64)
 * 
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format "iv:authTag:ciphertext" or original value if encryption disabled
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  // If encryption is not configured, return original value
  // This allows graceful degradation in development
  if (!isEncryptionEnabled()) {
    console.warn("⚠️ Encryption key not set - storing data unencrypted");
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");
    
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    // Format: base64(iv):base64(authTag):base64(ciphertext)
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt a string value encrypted with encrypt()
 * 
 * @param encryptedText - The encrypted string in format "iv:authTag:ciphertext"
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return encryptedText;
  }

  // Check if this looks like encrypted data (has the iv:authTag:ciphertext format)
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // Not encrypted data, return as-is (backward compatibility with unencrypted data)
    return encryptedText;
  }

  if (!isEncryptionEnabled()) {
    console.warn("⚠️ Encryption key not set - cannot decrypt data");
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const [ivBase64, authTagBase64, ciphertext] = parts;
    
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // If decryption fails, it might be unencrypted data (backward compatibility)
    // or the key might have changed
    console.error("Decryption error - data may be unencrypted or key mismatch:", error);
    return encryptedText;
  }
}

// ============ PII-Specific Functions ============

/**
 * Encrypt a phone number
 * @param phoneNumber - Phone number to encrypt
 * @returns Encrypted phone number
 */
export function encryptPhoneNumber(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) {
    return null;
  }
  return encrypt(phoneNumber);
}

/**
 * Decrypt a phone number
 * @param encryptedPhoneNumber - Encrypted phone number
 * @returns Decrypted phone number
 */
export function decryptPhoneNumber(encryptedPhoneNumber: string | null | undefined): string | null {
  if (!encryptedPhoneNumber) {
    return null;
  }
  return decrypt(encryptedPhoneNumber);
}

/**
 * Encrypt in-game IDs object
 * Encrypts each game ID value while keeping keys (game names) visible
 * 
 * @param inGameIds - Object with game names as keys and game IDs as values
 * @returns Object with encrypted game ID values
 */
export function encryptInGameIds(
  inGameIds: Record<string, string> | null | undefined
): Record<string, string> | null {
  if (!inGameIds || Object.keys(inGameIds).length === 0) {
    return null;
  }

  const encrypted: Record<string, string> = {};
  for (const [game, gameId] of Object.entries(inGameIds)) {
    encrypted[game] = encrypt(gameId);
  }
  return encrypted;
}

/**
 * Decrypt in-game IDs object
 * 
 * @param encryptedInGameIds - Object with game names as keys and encrypted game IDs as values
 * @returns Object with decrypted game ID values
 */
export function decryptInGameIds(
  encryptedInGameIds: Record<string, string> | null | undefined
): Record<string, string> | null {
  if (!encryptedInGameIds || Object.keys(encryptedInGameIds).length === 0) {
    return null;
  }

  const decrypted: Record<string, string> = {};
  for (const [game, encryptedGameId] of Object.entries(encryptedInGameIds)) {
    decrypted[game] = decrypt(encryptedGameId);
  }
  return decrypted;
}

/**
 * Encrypt a single game UID (for team members)
 * @param gameUid - Game UID to encrypt
 * @returns Encrypted game UID
 */
export function encryptGameUid(gameUid: string | null | undefined): string | null {
  if (!gameUid) {
    return null;
  }
  return encrypt(gameUid);
}

/**
 * Decrypt a single game UID
 * @param encryptedGameUid - Encrypted game UID
 * @returns Decrypted game UID
 */
export function decryptGameUid(encryptedGameUid: string | null | undefined): string | null {
  if (!encryptedGameUid) {
    return null;
  }
  return decrypt(encryptedGameUid);
}

// ============ Utility Functions ============

/**
 * Check if a value appears to be encrypted
 * (Has the iv:authTag:ciphertext format)
 * 
 * @param value - Value to check
 * @returns true if value appears to be encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const parts = value.split(":");
  return parts.length === 3 && parts.every(part => {
    try {
      // Check if each part is valid base64
      return Buffer.from(part, "base64").toString("base64") === part;
    } catch {
      return false;
    }
  });
}

/**
 * Safely decrypt a value, returning the original if not encrypted
 * @param value - Value to decrypt (may or may not be encrypted)
 * @returns Decrypted value or original if not encrypted
 */
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (isEncrypted(value)) {
    return decrypt(value);
  }
  return value;
}

/**
 * Decrypt user data object containing encrypted PII fields
 * Call this after fetching user data from the database
 * 
 * @param userData - User data object from database
 * @returns User data with decrypted PII fields
 */
export function decryptUserPII<T extends {
  phone_number?: string | null;
  in_game_ids?: Record<string, string> | null;
}>(userData: T): T {
  if (!userData) {
    return userData;
  }

  return {
    ...userData,
    phone_number: userData.phone_number 
      ? safeDecrypt(userData.phone_number) 
      : userData.phone_number,
    in_game_ids: userData.in_game_ids 
      ? decryptInGameIds(userData.in_game_ids) 
      : userData.in_game_ids,
  };
}

/**
 * Encrypt user PII fields before storing in database
 * 
 * @param phoneNumber - Phone number to encrypt
 * @param inGameIds - In-game IDs object to encrypt
 * @returns Object with encrypted values
 */
export function encryptUserPII(
  phoneNumber?: string | null,
  inGameIds?: Record<string, string> | null
): { 
  encryptedPhoneNumber: string | null; 
  encryptedInGameIds: Record<string, string> | null;
} {
  return {
    encryptedPhoneNumber: encryptPhoneNumber(phoneNumber),
    encryptedInGameIds: encryptInGameIds(inGameIds),
  };
}

/**
 * Decrypt team member game UID
 * @param teamMember - Team member object from database
 * @returns Team member with decrypted game_uid
 */
export function decryptTeamMemberGameUid<T extends { game_uid?: string | null }>(
  teamMember: T
): T {
  if (!teamMember || !teamMember.game_uid) {
    return teamMember;
  }

  return {
    ...teamMember,
    game_uid: safeDecrypt(teamMember.game_uid),
  };
}

// ============ Key Rotation Support ============

/**
 * Re-encrypt a value with the current key
 * Use this during key rotation to re-encrypt existing data
 * 
 * @param encryptedValue - Value encrypted with old key (after decryption)
 * @returns Value encrypted with current key
 */
export function reEncrypt(plaintext: string): string {
  return encrypt(plaintext);
}

/**
 * Clear the encryption key cache
 * Call this if you need to reload the key from environment
 */
export function clearKeyCache(): void {
  encryptionKeyCache = null;
}
