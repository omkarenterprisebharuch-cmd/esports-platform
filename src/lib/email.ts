import nodemailer from "nodemailer";
import {
  sendImmediateEmail,
  queueTransactionalEmail,
  queueNotificationEmail,
} from "./email-queue";

// Create reusable transporter (for OTP emails that must be immediate)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send OTP email to user
 */
export async function sendOTPEmail(
  email: string,
  otp: string,
  username: string = "User"
): Promise<void> {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "Email Verification OTP - Esports Platform",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
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
                  <td style="padding: 0 40px 20px 40px; text-align: center;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                      Verify Your Email
                    </h2>
                    <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                      Hello ${username},<br>
                      Use the following OTP to complete your registration.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 30px 40px; text-align: center;">
                    <div style="background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px;">
                      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">
                        ${otp}
                      </span>
                    </div>
                    <p style="margin: 16px 0 0 0; font-size: 14px; color: #9ca3af;">
                      This OTP is valid for <strong>10 minutes</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 40px 40px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                      If you didn't request this verification, please ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      © 2025 Esports Platform. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Esports Platform - Email Verification\n\nHello ${username},\n\nYour OTP for email verification is: ${otp}\n\nThis OTP is valid for 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Send password reset OTP email
 */
export async function sendPasswordResetOTPEmail(
  email: string,
  otp: string,
  username: string = "User"
): Promise<void> {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "Password Reset OTP - Esports Platform",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
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
                  <td style="padding: 0 40px 20px 40px; text-align: center;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                      Reset Your Password
                    </h2>
                    <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                      Hello ${username},<br>
                      Use the following OTP to reset your password.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 30px 40px; text-align: center;">
                    <div style="background-color: #fef2f2; border: 2px dashed #fecaca; border-radius: 12px; padding: 24px;">
                      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #dc2626; font-family: monospace;">
                        ${otp}
                      </span>
                    </div>
                    <p style="margin: 16px 0 0 0; font-size: 14px; color: #9ca3af;">
                      This OTP is valid for <strong>10 minutes</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 40px 40px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                      If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      © 2025 Esports Platform. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Esports Platform - Password Reset\n\nHello ${username},\n\nYour OTP for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Send new device login alert email
 */
export async function sendNewDeviceLoginEmail(
  email: string,
  username: string = "User",
  deviceInfo: {
    deviceName: string;
    browser: string;
    os: string;
    ipAddress: string;
    loginTime: Date;
  }
): Promise<void> {
  const formattedTime = deviceInfo.loginTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const mailOptions = {
    from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "🔔 New Device Login Detected - Esports Platform",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Device Login Alert</title>
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
                  <td style="padding: 0 40px 20px 40px; text-align: center;">
                    <div style="background-color: #fef3c7; border-radius: 50%; width: 64px; height: 64px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                      <span style="font-size: 32px;">🔔</span>
                    </div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                      New Device Login Detected
                    </h2>
                    <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                      Hello ${username},<br>
                      We detected a login to your account from a new device.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Device:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${deviceInfo.deviceName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Browser:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${deviceInfo.browser}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Operating System:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${deviceInfo.os}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">IP Address:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${deviceInfo.ipAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${formattedTime}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 30px 40px; text-align: center;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                      If this was you, you can safely ignore this email.
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #dc2626; font-weight: 500; line-height: 1.5;">
                      ⚠️ If you didn't log in from this device, please change your password immediately and review your active sessions.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      © 2025 Esports Platform. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Esports Platform - New Device Login Alert\n\nHello ${username},\n\nWe detected a login to your account from a new device.\n\nDevice: ${deviceInfo.deviceName}\nBrowser: ${deviceInfo.browser}\nOperating System: ${deviceInfo.os}\nIP Address: ${deviceInfo.ipAddress}\nTime: ${formattedTime}\n\nIf this was you, you can safely ignore this email.\n\nIf you didn't log in from this device, please change your password immediately and review your active sessions.`,
  };

  // Queue as high priority transactional email (security-related)
  queueTransactionalEmail(email, mailOptions.subject, mailOptions.html, mailOptions.text);
}

/**
 * Send suspicious login activity alert email
 */
export async function sendSuspiciousLoginEmail(
  email: string,
  username: string = "User",
  loginInfo: {
    ipAddress: string;
    loginTime: Date;
    reasons: string[];
    riskScore: number;
  }
): Promise<void> {
  const formattedTime = loginInfo.loginTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const riskLevel = loginInfo.riskScore >= 70 ? 'High' : loginInfo.riskScore >= 40 ? 'Medium' : 'Low';
  const riskColor = loginInfo.riskScore >= 70 ? '#dc2626' : loginInfo.riskScore >= 40 ? '#f59e0b' : '#10b981';

  const reasonsHtml = loginInfo.reasons.map(r => 
    `<li style="margin: 8px 0; color: #374151;">${r}</li>`
  ).join('');

  const mailOptions = {
    from: `"Esports Platform Security" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "⚠️ Suspicious Login Activity Detected - Esports Platform",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suspicious Login Alert</title>
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
                  <td style="padding: 0 40px 20px 40px; text-align: center;">
                    <div style="background-color: #fef2f2; border-radius: 50%; width: 64px; height: 64px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                      <span style="font-size: 32px;">⚠️</span>
                    </div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                      Suspicious Login Detected
                    </h2>
                    <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                      Hello ${username},<br>
                      We detected unusual activity on your account that may indicate unauthorized access.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; text-align: center;">
                      <span style="font-size: 14px; color: #6b7280;">Risk Level:</span>
                      <span style="font-size: 18px; font-weight: 700; color: ${riskColor}; margin-left: 8px;">${riskLevel}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Login Details:</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">IP Address:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${loginInfo.ipAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time:</td>
                          <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${formattedTime}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Why this was flagged:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${reasonsHtml}
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 30px 40px; text-align: center;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #dc2626; font-weight: 500; line-height: 1.5;">
                      🔒 If this wasn't you, please take these steps immediately:
                    </p>
                    <ol style="text-align: left; margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                      <li>Change your password</li>
                      <li>Review and logout all active sessions</li>
                      <li>Enable two-factor authentication if available</li>
                    </ol>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      © 2025 Esports Platform. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Esports Platform - Suspicious Login Activity Detected\n\nHello ${username},\n\nWe detected unusual activity on your account that may indicate unauthorized access.\n\nRisk Level: ${riskLevel}\nIP Address: ${loginInfo.ipAddress}\nTime: ${formattedTime}\n\nWhy this was flagged:\n${loginInfo.reasons.map(r => `- ${r}`).join('\n')}\n\nIf this wasn't you, please:\n1. Change your password immediately\n2. Review and logout all active sessions\n3. Enable two-factor authentication if available`,
  };

  // Queue as high priority transactional email (security alert)
  queueTransactionalEmail(email, mailOptions.subject, mailOptions.html, mailOptions.text);
}
