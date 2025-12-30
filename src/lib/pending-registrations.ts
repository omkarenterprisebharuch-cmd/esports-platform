// Temporary storage for pending registrations
// This is shared between send-otp and verify-otp routes
// In production, use Redis or database for this

interface PendingRegistration {
  username: string;
  email: string;
  hashedPassword: string;
  createdAt: number;
  // GDPR consent tracking
  consentIp?: string;
  consentUserAgent?: string;
}

export const pendingRegistrations = new Map<string, PendingRegistration>();

// Cleanup old registrations periodically
export function cleanupOldRegistrations() {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  
  for (const [email, data] of pendingRegistrations.entries()) {
    if (now - data.createdAt > fifteenMinutes) {
      pendingRegistrations.delete(email);
    }
  }
}

export function storePendingRegistration(
  email: string,
  data: Omit<PendingRegistration, 'createdAt'>
) {
  pendingRegistrations.set(email.toLowerCase(), {
    ...data,
    createdAt: Date.now(),
  });

  // Auto-cleanup after 15 minutes
  setTimeout(() => {
    pendingRegistrations.delete(email.toLowerCase());
  }, 15 * 60 * 1000);
}

export function getPendingRegistration(email: string): PendingRegistration | undefined {
  return pendingRegistrations.get(email.toLowerCase());
}

export function deletePendingRegistration(email: string) {
  pendingRegistrations.delete(email.toLowerCase());
}
