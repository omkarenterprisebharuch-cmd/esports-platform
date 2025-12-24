import nodemailer from "nodemailer";

// Create reusable transporter
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
