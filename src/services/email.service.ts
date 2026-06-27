import nodemailer from 'nodemailer';
import env from '../config/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  /** Sends an email using the configured SMTP transport; failures are logged but don't throw */
  private async send(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      console.error(`Failed to send email to ${options.to}:`, error);
      // Don't throw — email failure shouldn't block the flow
    }
  }

  /** Sends an email with file attachments (e.g., PDF invoices) */
  async sendWithAttachment(
    to: string,
    subject: string,
    html: string,
    attachments: EmailAttachment[]
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
        to,
        subject,
        html,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    } catch (error) {
      console.error(`Failed to send email with attachment to ${to}:`, error);
    }
  }

  /** Sends a verification OTP email with a styled HTML template */
  async sendOtp(email: string, otp: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your Verification Code - Job Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email</h2>
          <p>Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">${otp}</span>
          </div>
          <p>This code expires in <strong>5 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
      text: `Your verification code is: ${otp}. This code expires in 5 minutes.`,
    });
  }

  /** Sends a welcome email after successful account registration */
  async sendWelcome(email: string, firstName: string, role: string): Promise<void> {
    await this.send({
      to: email,
      subject: `Welcome to Job Platform!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome, ${firstName}!</h2>
          <p>Your ${role} account has been created successfully.</p>
          <p>${role === 'employee'
            ? 'Start exploring jobs and build your profile to attract employers.'
            : 'Start posting jobs and find the best talent for your team.'
          }</p>
          <p style="margin-top: 20px;">
            <a href="${env.CORS_ORIGIN}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              Get Started
            </a>
          </p>
        </div>
      `,
    });
  }

  /** Sends an email notifying the applicant of a status change on their application */
  async sendApplicationStatusUpdate(
    email: string,
    firstName: string,
    jobTitle: string,
    status: string
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      shortlisted: 'Congratulations! You have been shortlisted.',
      rejected: 'Unfortunately, your application was not selected.',
      interview: 'You have been invited for an interview!',
      offer: 'Congratulations! You have received an offer!',
    };

    const message = statusMessages[status] || `Your application status has been updated to: ${status}`;

    await this.send({
      to: email,
      subject: `Application Update: ${jobTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${firstName},</h2>
          <p>${message}</p>
          <p><strong>Job:</strong> ${jobTitle}</p>
          <p><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}</p>
          <p style="margin-top: 20px;">
            <a href="${env.CORS_ORIGIN}/applications" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              View Application
            </a>
          </p>
        </div>
      `,
    });
  }

  /** Sends an email to the employer when a new application is received */
  async sendNewApplicationNotification(
    email: string,
    employerName: string,
    jobTitle: string,
    applicantName: string
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `New Application: ${jobTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${employerName},</h2>
          <p><strong>${applicantName}</strong> has applied for <strong>${jobTitle}</strong>.</p>
          <p style="margin-top: 20px;">
            <a href="${env.CORS_ORIGIN}/employer/applications" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              Review Application
            </a>
          </p>
        </div>
      `,
    });
  }

  /** Sends an account suspension notification email */
  async sendAccountSuspended(email: string, firstName: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Account Suspended - Job Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${firstName},</h2>
          <p>Your account has been suspended by an administrator.</p>
          <p>If you believe this is a mistake, please contact our support team.</p>
        </div>
      `,
    });
  }
}

export default new EmailService();
