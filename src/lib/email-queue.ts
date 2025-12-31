/**
 * Email Queue System
 * 
 * Implements efficient email queuing with:
 * - In-memory queue with optional Redis persistence
 * - Batching similar notifications
 * - Rate limiting to avoid SMTP throttling
 * - Retry logic for failed emails
 * - Priority queue for urgent emails
 * 
 * @module email-queue
 */

import nodemailer from "nodemailer";
import { cache, TTL } from "./redis";

// ============ Configuration ============

export const EMAIL_QUEUE_CONFIG = {
  // Rate limiting
  MAX_EMAILS_PER_MINUTE: 30,
  MAX_EMAILS_PER_HOUR: 500,
  
  // Batching
  BATCH_WINDOW_MS: 30000, // 30 seconds to collect similar emails
  MAX_BATCH_SIZE: 50, // Max emails in a single batch
  
  // Processing
  PROCESS_INTERVAL_MS: 5000, // Check queue every 5 seconds
  
  // Retry logic
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 60000, // 1 minute between retries
  
  // Queue limits
  MAX_QUEUE_SIZE: 1000,
};

// ============ Types ============

export type EmailPriority = "high" | "normal" | "low";

export interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority: EmailPriority;
  category: string; // For batching similar emails
  createdAt: Date;
  scheduledAt?: Date; // For delayed sending
  attempts: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailBatch {
  category: string;
  recipients: string[];
  subject: string;
  html: string;
  text?: string;
  createdAt: Date;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  rateLimited: boolean;
  emailsSentThisMinute: number;
  emailsSentThisHour: number;
}

// ============ In-Memory Queue State ============

// Main queue with priority support
const emailQueue: Map<EmailPriority, QueuedEmail[]> = new Map([
  ["high", []],
  ["normal", []],
  ["low", []],
]);

// Batch collection windows
const batchWindows: Map<string, {
  emails: QueuedEmail[];
  windowStart: Date;
  timer: NodeJS.Timeout | null;
}> = new Map();

// Rate limiting tracking
let emailsSentThisMinute = 0;
let emailsSentThisHour = 0;
let lastMinuteReset = Date.now();
let lastHourReset = Date.now();

// Processing state
let isProcessing = false;
let processInterval: NodeJS.Timeout | null = null;
let completedCount = 0;
let failedCount = 0;

// ============ Transporter ============

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10, // 10 emails per second max
    });
  }
  return transporter;
}

// ============ Rate Limiting ============

function resetRateLimitsIfNeeded(): void {
  const now = Date.now();
  
  // Reset minute counter
  if (now - lastMinuteReset >= 60000) {
    emailsSentThisMinute = 0;
    lastMinuteReset = now;
  }
  
  // Reset hour counter
  if (now - lastHourReset >= 3600000) {
    emailsSentThisHour = 0;
    lastHourReset = now;
  }
}

function canSendEmail(): boolean {
  resetRateLimitsIfNeeded();
  
  return (
    emailsSentThisMinute < EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_MINUTE &&
    emailsSentThisHour < EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_HOUR
  );
}

function recordEmailSent(): void {
  emailsSentThisMinute++;
  emailsSentThisHour++;
}

// ============ ID Generation ============

function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Queue Operations ============

/**
 * Add an email to the queue
 */
export function queueEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority?: EmailPriority;
  category?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}): string {
  const priority = options.priority || "normal";
  const category = options.category || "default";
  
  const email: QueuedEmail = {
    id: generateEmailId(),
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    priority,
    category,
    createdAt: new Date(),
    scheduledAt: options.scheduledAt,
    attempts: 0,
    metadata: options.metadata,
  };
  
  // Check queue size limit
  const totalQueued = getTotalQueueSize();
  if (totalQueued >= EMAIL_QUEUE_CONFIG.MAX_QUEUE_SIZE) {
    console.warn("[EmailQueue] Queue full, dropping low priority email");
    // Remove oldest low priority email
    const lowQueue = emailQueue.get("low") || [];
    if (lowQueue.length > 0) {
      lowQueue.shift();
    }
  }
  
  // Add to appropriate priority queue
  const queue = emailQueue.get(priority) || [];
  queue.push(email);
  emailQueue.set(priority, queue);
  
  // Start processing if not already running
  startProcessing();
  
  console.log(`[EmailQueue] Queued email ${email.id} to ${email.to} (${priority})`);
  return email.id;
}

/**
 * Queue an email for batching with similar emails
 */
export function queueEmailForBatching(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category: string;
  priority?: EmailPriority;
  metadata?: Record<string, unknown>;
}): string {
  const category = options.category;
  
  const email: QueuedEmail = {
    id: generateEmailId(),
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    priority: options.priority || "normal",
    category,
    createdAt: new Date(),
    attempts: 0,
    metadata: options.metadata,
  };
  
  // Get or create batch window
  let window = batchWindows.get(category);
  
  if (!window) {
    window = {
      emails: [],
      windowStart: new Date(),
      timer: null,
    };
    batchWindows.set(category, window);
  }
  
  window.emails.push(email);
  
  // Set timer to process batch if not already set
  if (!window.timer) {
    window.timer = setTimeout(() => {
      processBatchWindow(category);
    }, EMAIL_QUEUE_CONFIG.BATCH_WINDOW_MS);
  }
  
  // Force process if batch is full
  if (window.emails.length >= EMAIL_QUEUE_CONFIG.MAX_BATCH_SIZE) {
    if (window.timer) {
      clearTimeout(window.timer);
    }
    processBatchWindow(category);
  }
  
  console.log(`[EmailQueue] Added email ${email.id} to batch "${category}" (${window.emails.length} emails)`);
  return email.id;
}

/**
 * Process a batch window - creates digest email or individual emails
 */
function processBatchWindow(category: string): void {
  const window = batchWindows.get(category);
  if (!window || window.emails.length === 0) {
    batchWindows.delete(category);
    return;
  }
  
  if (window.timer) {
    clearTimeout(window.timer);
  }
  
  const emails = window.emails;
  batchWindows.delete(category);
  
  // Group emails by recipient
  const byRecipient = new Map<string, QueuedEmail[]>();
  for (const email of emails) {
    const existing = byRecipient.get(email.to) || [];
    existing.push(email);
    byRecipient.set(email.to, existing);
  }
  
  // Process each recipient's batch
  for (const [recipient, recipientEmails] of byRecipient) {
    if (recipientEmails.length === 1) {
      // Single email - queue normally
      const e = recipientEmails[0];
      const queue = emailQueue.get(e.priority) || [];
      queue.push(e);
      emailQueue.set(e.priority, queue);
    } else {
      // Multiple emails - create digest
      const digestEmail = createDigestEmail(recipient, recipientEmails, category);
      const queue = emailQueue.get("normal") || [];
      queue.push(digestEmail);
      emailQueue.set("normal", queue);
      
      console.log(`[EmailQueue] Created digest for ${recipient} with ${recipientEmails.length} notifications`);
    }
  }
  
  startProcessing();
}

/**
 * Create a digest email combining multiple notifications
 */
function createDigestEmail(recipient: string, emails: QueuedEmail[], category: string): QueuedEmail {
  const itemsHtml = emails
    .map(e => `<li style="margin-bottom: 10px;">${e.subject}</li>`)
    .join("");
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 40px 30px 40px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">
                    🎮 Esports Platform
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 20px 40px;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                    You have ${emails.length} new notifications
                  </h2>
                  <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                    Here's a summary of your recent updates:
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 30px 40px;">
                  <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.8;">
                    ${itemsHtml}
                  </ul>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 30px 40px; text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/dashboard" 
                     style="display: inline-block; padding: 14px 28px; background-color: #7c3aed; 
                            color: #ffffff; text-decoration: none; font-weight: 600; 
                            border-radius: 8px; font-size: 16px;">
                    View Dashboard
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    © ${new Date().getFullYear()} Esports Platform. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const textItems = emails.map(e => `• ${e.subject}`).join("\n");
  const text = `Esports Platform - ${emails.length} New Notifications\n\n${textItems}\n\nVisit your dashboard to see more details.`;
  
  return {
    id: generateEmailId(),
    to: recipient,
    subject: `📬 ${emails.length} new notifications from Esports Platform`,
    html,
    text,
    priority: "normal",
    category: `digest_${category}`,
    createdAt: new Date(),
    attempts: 0,
    metadata: {
      isDigest: true,
      originalCount: emails.length,
      originalCategory: category,
    },
  };
}

// ============ Queue Processing ============

function getTotalQueueSize(): number {
  let total = 0;
  for (const queue of emailQueue.values()) {
    total += queue.length;
  }
  return total;
}

function getNextEmail(): QueuedEmail | null {
  // Process in priority order: high > normal > low
  for (const priority of ["high", "normal", "low"] as EmailPriority[]) {
    const queue = emailQueue.get(priority) || [];
    
    // Find first email that's ready to send (not scheduled for later, not in retry delay)
    const now = Date.now();
    const index = queue.findIndex(email => {
      // Check scheduled time
      if (email.scheduledAt && email.scheduledAt.getTime() > now) {
        return false;
      }
      // Check retry delay
      if (email.attempts > 0 && email.lastError) {
        const lastAttemptTime = email.createdAt.getTime();
        const retryDelay = email.attempts * EMAIL_QUEUE_CONFIG.RETRY_DELAY_MS;
        if (now - lastAttemptTime < retryDelay) {
          return false;
        }
      }
      return true;
    });
    
    if (index !== -1) {
      return queue.splice(index, 1)[0];
    }
  }
  
  return null;
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    while (true) {
      // Check rate limits
      if (!canSendEmail()) {
        console.log("[EmailQueue] Rate limited, waiting...");
        break;
      }
      
      // Get next email
      const email = getNextEmail();
      if (!email) break;
      
      // Send email
      try {
        const transport = getTransporter();
        
        await transport.sendMail({
          from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text || email.subject,
        });
        
        recordEmailSent();
        completedCount++;
        
        console.log(`[EmailQueue] Sent email ${email.id} to ${email.to}`);
        
        // Update Redis stats if available
        await updateQueueStats();
        
      } catch (error) {
        email.attempts++;
        email.lastError = error instanceof Error ? error.message : String(error);
        email.createdAt = new Date(); // Reset for retry delay calculation
        
        console.error(`[EmailQueue] Failed to send ${email.id}:`, email.lastError);
        
        if (email.attempts < EMAIL_QUEUE_CONFIG.MAX_RETRIES) {
          // Re-queue for retry
          const queue = emailQueue.get(email.priority) || [];
          queue.push(email);
          emailQueue.set(email.priority, queue);
          console.log(`[EmailQueue] Re-queued ${email.id} for retry (attempt ${email.attempts}/${EMAIL_QUEUE_CONFIG.MAX_RETRIES})`);
        } else {
          failedCount++;
          console.error(`[EmailQueue] Permanently failed ${email.id} after ${EMAIL_QUEUE_CONFIG.MAX_RETRIES} attempts`);
          
          // Store failed email for review
          await storeFailedEmail(email);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

async function storeFailedEmail(email: QueuedEmail): Promise<void> {
  try {
    await cache.set(
      `email:failed:${email.id}`,
      JSON.stringify({
        ...email,
        failedAt: new Date().toISOString(),
      }),
      TTL.DAY * 7 // Keep failed emails for 7 days
    );
  } catch {
    // Ignore Redis errors
  }
}

async function updateQueueStats(): Promise<void> {
  try {
    const stats = getQueueStats();
    await cache.set("email:queue:stats", JSON.stringify(stats), TTL.SHORT);
  } catch {
    // Ignore Redis errors
  }
}

// ============ Queue Control ============

/**
 * Start queue processing
 */
export function startProcessing(): void {
  if (processInterval) return;
  
  processInterval = setInterval(() => {
    processQueue().catch(err => {
      console.error("[EmailQueue] Processing error:", err);
    });
  }, EMAIL_QUEUE_CONFIG.PROCESS_INTERVAL_MS);
  
  // Process immediately
  processQueue().catch(err => {
    console.error("[EmailQueue] Processing error:", err);
  });
  
  console.log("[EmailQueue] Started processing");
}

/**
 * Stop queue processing
 */
export function stopProcessing(): void {
  if (processInterval) {
    clearInterval(processInterval);
    processInterval = null;
  }
  
  // Clear batch timers
  for (const [, window] of batchWindows) {
    if (window.timer) {
      clearTimeout(window.timer);
    }
  }
  
  console.log("[EmailQueue] Stopped processing");
}

/**
 * Get current queue statistics
 */
export function getQueueStats(): QueueStats {
  resetRateLimitsIfNeeded();
  
  return {
    pending: getTotalQueueSize(),
    processing: isProcessing ? 1 : 0,
    completed: completedCount,
    failed: failedCount,
    rateLimited: !canSendEmail(),
    emailsSentThisMinute,
    emailsSentThisHour,
  };
}

/**
 * Clear the queue (for testing or emergency)
 */
export function clearQueue(): void {
  emailQueue.set("high", []);
  emailQueue.set("normal", []);
  emailQueue.set("low", []);
  
  for (const [, window] of batchWindows) {
    if (window.timer) {
      clearTimeout(window.timer);
    }
  }
  batchWindows.clear();
  
  console.log("[EmailQueue] Cleared queue");
}

/**
 * Flush all pending emails immediately (bypass rate limits)
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  // First, process all batch windows
  for (const category of batchWindows.keys()) {
    processBatchWindow(category);
  }
  
  // Then send all queued emails
  const transport = getTransporter();
  
  for (const priority of ["high", "normal", "low"] as EmailPriority[]) {
    const queue = emailQueue.get(priority) || [];
    
    while (queue.length > 0) {
      const email = queue.shift()!;
      
      try {
        await transport.sendMail({
          from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text || email.subject,
        });
        sent++;
        completedCount++;
      } catch (error) {
        failed++;
        failedCount++;
        console.error(`[EmailQueue] Flush failed for ${email.id}:`, error);
      }
    }
    
    emailQueue.set(priority, []);
  }
  
  console.log(`[EmailQueue] Flushed queue: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// ============ High-Level Email Functions ============

/**
 * Queue a notification email (batched by type)
 */
export function queueNotificationEmail(
  to: string,
  subject: string,
  html: string,
  options?: {
    priority?: EmailPriority;
    type?: string;
    text?: string;
  }
): string {
  return queueEmailForBatching({
    to,
    subject,
    html,
    text: options?.text,
    category: options?.type || "notification",
    priority: options?.priority || "normal",
  });
}

/**
 * Queue a transactional email (sent immediately, high priority)
 */
export function queueTransactionalEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): string {
  return queueEmail({
    to,
    subject,
    html,
    text,
    priority: "high",
    category: "transactional",
  });
}

/**
 * Queue a marketing/digest email (low priority, heavily batched)
 */
export function queueMarketingEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): string {
  return queueEmailForBatching({
    to,
    subject,
    html,
    text,
    category: "marketing",
    priority: "low",
  });
}

/**
 * Send an email immediately, bypassing the queue
 * Use sparingly for critical emails like OTP
 */
export async function sendImmediateEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  if (!canSendEmail()) {
    // Still respect rate limits for immediate emails
    throw new Error("Rate limited - too many emails sent recently");
  }
  
  const transport = getTransporter();
  
  await transport.sendMail({
    from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: text || subject,
  });
  
  recordEmailSent();
  completedCount++;
}

// ============ Cleanup ============

/**
 * Gracefully shutdown the email queue
 */
export async function shutdown(): Promise<void> {
  console.log("[EmailQueue] Shutting down...");
  
  stopProcessing();
  
  // Wait for current processing to complete
  while (isProcessing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Close transporter
  if (transporter) {
    transporter.close();
    transporter = null;
  }
  
  console.log("[EmailQueue] Shutdown complete");
}
