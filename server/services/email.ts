import { MailService } from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'support@lotquote.com'; // Update this with your verified sender

if (!SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY environment variable is not set. Email functionality will not work.');
}

// Initialize the mail service
const mailService = new MailService();
if (SENDGRID_API_KEY) {
  mailService.setApiKey(SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.error('Cannot send email: SENDGRID_API_KEY is not set');
    return false;
  }

  try {
    await mailService.send({
      to: params.to,
      from: FROM_EMAIL as string,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    });
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(to: string, resetToken: string, username: string): Promise<boolean> {
  // Get the app base URL from environment or default to localhost
  const baseUrl = process.env.APP_URL || 'http://localhost:5000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const subject = 'Reset Your LotQuote Password';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">LotQuote</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <h2>Reset Your Password</h2>
        <p>Hello ${username},</p>
        <p>We received a request to reset your password for your LotQuote account. If you didn't make this request, you can safely ignore this email.</p>
        <p>To reset your password, click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #4f46e5;">${resetUrl}</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you need assistance, please contact our support team at support@lotquote.com.</p>
      </div>
      <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} LotQuote. All rights reserved.</p>
      </div>
    </div>
  `;

  const text = `
    Reset Your Password

    Hello ${username},

    We received a request to reset your password for your LotQuote account. If you didn't make this request, you can safely ignore this email.

    To reset your password, visit this link: ${resetUrl}

    This link will expire in 1 hour for security reasons.

    If you need assistance, please contact our support team at support@lotquote.com.

    © ${new Date().getFullYear()} LotQuote. All rights reserved.
  `;

  return sendEmail({ to, subject, html, text });
}
