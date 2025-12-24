// OTP Generation and Storage Utility
// Using a Map for in-memory storage (for production, consider Redis)

interface OTPData {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OTPData>();

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
 * Store OTP for email with expiration
 */
export function storeOTP(
  email: string,
  otp: string,
  expiresInMinutes: number = 10
): void {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt,
    attempts: 0,
  });

  // Auto-cleanup after expiration
  setTimeout(() => {
    otpStore.delete(email.toLowerCase());
  }, expiresInMinutes * 60 * 1000);
}

/**
 * Verify OTP for email
 */
export function verifyOTP(
  email: string,
  otp: string
): { valid: boolean; message: string } {
  const stored = otpStore.get(email.toLowerCase());

  if (!stored) {
    return {
      valid: false,
      message: "OTP not found or expired. Please request a new OTP.",
    };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return { valid: false, message: "OTP has expired. Please request a new OTP." };
  }

  if (stored.attempts >= 3) {
    otpStore.delete(email.toLowerCase());
    return {
      valid: false,
      message: "Too many failed attempts. Please request a new OTP.",
    };
  }

  if (stored.otp !== otp.toUpperCase()) {
    stored.attempts += 1;
    return {
      valid: false,
      message: `Invalid OTP. ${3 - stored.attempts} attempts remaining.`,
    };
  }

  // OTP is valid - remove it from store
  otpStore.delete(email.toLowerCase());
  return { valid: true, message: "OTP verified successfully." };
}

/**
 * Check if email has a pending OTP
 */
export function hasPendingOTP(email: string): boolean {
  const stored = otpStore.get(email.toLowerCase());
  return stored !== undefined && Date.now() < stored.expiresAt;
}
