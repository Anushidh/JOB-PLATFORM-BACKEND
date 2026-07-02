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

export class EmailService {
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

  /** Sends an interview invitation email with all scheduling details */
  async sendInterviewInvite(data: {
    email: string;
    firstName: string;
    jobTitle: string;
    companyName: string;
    date: string;
    time: string;
    type: string;
    meetingLink?: string;
    location?: string;
    notes?: string;
  }): Promise<void> {
    const { email, firstName, jobTitle, companyName, date, time, type, meetingLink, location, notes } = data;

    const formattedDate = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let locationHtml = '';
    if (type === 'video' && meetingLink) {
      locationHtml = `<p><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #2563eb;">${meetingLink}</a></p>`;
    } else if (type === 'in-person' && location) {
      locationHtml = `<p><strong>Location:</strong> ${location}</p>`;
    } else if (type === 'phone') {
      locationHtml = `<p><strong>Note:</strong> The interviewer will call you on your registered phone number.</p>`;
    }

    await this.send({
      to: email,
      subject: `Interview Invitation: ${jobTitle} at ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${firstName},</h2>
          <p>Great news! You've been invited for an interview at <strong>${companyName}</strong>.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Position:</strong> ${jobTitle}</p>
            <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 0 0 8px;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 0 0 8px;"><strong>Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}${type === 'video' ? ' Call' : type === 'in-person' ? '' : ' Call'}</p>
            ${locationHtml}
            ${notes ? `<p style="margin: 12px 0 0; padding-top: 12px; border-top: 1px solid #e2e8f0;"><strong>Additional Notes:</strong><br/>${notes}</p>` : ''}
          </div>

          <p style="margin-top: 20px;">
            <a href="${env.CORS_ORIGIN}/employee/applications" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Application
            </a>
          </p>

          <p style="color: #64748b; margin-top: 20px; font-size: 14px;">Good luck with your interview! 🎉</p>
        </div>
      `,
    });
  }
}

