import JobAlert, { IJobAlert } from '../models/JobAlert';
import Job from '../models/Job';
import Employee from '../models/Employee';
import { ApiError } from '../utils/apiError';
import { JobStatus } from '../types';
import emailService from './email.service';

const MAX_ALERTS_PER_USER = 5;

interface AlertData {
  name: string;
  filters: {
    keywords?: string[];
    location?: string;
    jobType?: string[];
    workMode?: string[];
    experienceLevel?: string[];
    salaryMin?: number;
    skills?: string[];
  };
  frequency: 'daily' | 'weekly' | 'instant';
}

class JobAlertService {
  /** Creates a job alert with filter criteria, enforcing a max of 5 alerts per user */
  async createAlert(employeeId: string, data: AlertData): Promise<IJobAlert> {
    // Check max alerts limit
    const alertCount = await JobAlert.countDocuments({ employee: employeeId });
    if (alertCount >= MAX_ALERTS_PER_USER) {
      throw ApiError.badRequest(`You can have a maximum of ${MAX_ALERTS_PER_USER} job alerts`);
    }

    const alert = await JobAlert.create({
      employee: employeeId,
      name: data.name,
      filters: data.filters,
      frequency: data.frequency,
      isActive: true,
    });

    return alert;
  }

  /** Updates alert name, filters, or frequency */
  async updateAlert(alertId: string, employeeId: string, data: Partial<AlertData>): Promise<IJobAlert> {
    const alert = await JobAlert.findOne({ _id: alertId, employee: employeeId });
    if (!alert) {
      throw ApiError.notFound('Job alert not found');
    }

    if (data.name) alert.name = data.name;
    if (data.filters) alert.filters = { ...alert.filters, ...data.filters };
    if (data.frequency) alert.frequency = data.frequency;

    await alert.save();
    return alert;
  }

  /** Permanently deletes a job alert */
  async deleteAlert(alertId: string, employeeId: string): Promise<void> {
    const alert = await JobAlert.findOne({ _id: alertId, employee: employeeId });
    if (!alert) {
      throw ApiError.notFound('Job alert not found');
    }

    await JobAlert.deleteOne({ _id: alertId });
  }

  /** Returns all job alerts belonging to an employee */
  async getMyAlerts(employeeId: string): Promise<IJobAlert[]> {
    return JobAlert.find({ employee: employeeId }).sort({ createdAt: -1 });
  }

  /** Toggles an alert's active/inactive state */
  async toggleAlert(alertId: string, employeeId: string): Promise<IJobAlert> {
    const alert = await JobAlert.findOne({ _id: alertId, employee: employeeId });
    if (!alert) {
      throw ApiError.notFound('Job alert not found');
    }

    alert.isActive = !alert.isActive;
    await alert.save();
    return alert;
  }

  /** Builds a MongoDB query from alert filter criteria and an optional since-date */
  private buildJobQuery(filters: IJobAlert['filters'], since?: Date) {
    const query: any = { status: JobStatus.ACTIVE };

    if (since) {
      query.createdAt = { $gte: since };
    }

    if (filters.keywords && filters.keywords.length > 0) {
      const keywordRegex = filters.keywords.map((k) => new RegExp(k, 'i'));
      query.$or = [
        { title: { $in: keywordRegex } },
        { description: { $in: keywordRegex } },
      ];
    }

    if (filters.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    if (filters.jobType && filters.jobType.length > 0) {
      query.jobType = { $in: filters.jobType };
    }

    if (filters.workMode && filters.workMode.length > 0) {
      query.workMode = { $in: filters.workMode };
    }

    if (filters.experienceLevel && filters.experienceLevel.length > 0) {
      query.experienceLevel = { $in: filters.experienceLevel };
    }

    if (filters.salaryMin) {
      query.salaryMax = { $gte: filters.salaryMin };
    }

    if (filters.skills && filters.skills.length > 0) {
      query.skillsRequired = { $in: filters.skills.map((s) => new RegExp(s, 'i')) };
    }

    return query;
  }

  /** Processes daily/weekly alerts: finds matching new jobs since last send and emails results */
  async checkAndSendAlerts(): Promise<void> {
    const now = new Date();

    // Get all active daily and weekly alerts
    const alerts = await JobAlert.find({
      isActive: true,
      frequency: { $in: ['daily', 'weekly'] },
    }).populate('employee', 'email firstName');

    for (const alert of alerts) {
      try {
        // Determine if it's time to send based on frequency
        if (alert.lastSentAt) {
          const hoursSinceLastSent = (now.getTime() - alert.lastSentAt.getTime()) / (1000 * 60 * 60);
          if (alert.frequency === 'daily' && hoursSinceLastSent < 24) continue;
          if (alert.frequency === 'weekly' && hoursSinceLastSent < 168) continue;
        }

        // Query for matching jobs since last sent
        const since = alert.lastSentAt || new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const query = this.buildJobQuery(alert.filters, since);
        const matchingJobs = await Job.find(query).limit(10).select('title company location jobType');

        if (matchingJobs.length > 0) {
          const employee = alert.employee as any;
          await this.sendAlertEmail(
            employee.email,
            employee.firstName,
            alert.name,
            matchingJobs
          );
        }

        // Update lastSentAt
        alert.lastSentAt = now;
        await alert.save();
      } catch (error) {
        console.error(`[JobAlert] Error processing alert ${alert._id}:`, error);
      }
    }
  }

  /** Checks all instant alerts when a job is activated and emails matching subscribers */
  async checkInstantAlerts(jobId: string): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job || job.status !== JobStatus.ACTIVE) return;

    // Get all active instant alerts
    const alerts = await JobAlert.find({
      isActive: true,
      frequency: 'instant',
    }).populate('employee', 'email firstName');

    for (const alert of alerts) {
      try {
        const query = this.buildJobQuery(alert.filters);
        // Check if this specific job matches the alert filters
        const matchingJob = await Job.findOne({ _id: jobId, ...query });

        if (matchingJob) {
          const employee = alert.employee as any;
          await this.sendAlertEmail(
            employee.email,
            employee.firstName,
            alert.name,
            [matchingJob]
          );

          alert.lastSentAt = new Date();
          await alert.save();
        }
      } catch (error) {
        console.error(`[JobAlert] Error processing instant alert ${alert._id}:`, error);
      }
    }
  }

  /** Sends an HTML email listing matching job openings for an alert */
  private async sendAlertEmail(
    email: string,
    firstName: string,
    alertName: string,
    jobs: any[]
  ): Promise<void> {
    const jobListHtml = jobs
      .map((job) => `<li><strong>${job.title}</strong> — ${job.location} (${job.jobType})</li>`)
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${firstName},</h2>
        <p>New jobs matching your alert "<strong>${alertName}</strong>":</p>
        <ul style="padding-left: 20px;">
          ${jobListHtml}
        </ul>
        <p>${jobs.length >= 10 ? 'And more...' : ''}</p>
        <p style="margin-top: 20px;">
          <a href="${process.env.CORS_ORIGIN || 'http://localhost:3000'}/jobs" 
             style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            View All Matches
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          You can manage your job alerts in your account settings.
        </p>
      </div>
    `;

    // Use the email service's send method pattern
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Job Platform'}" <${process.env.SMTP_FROM_EMAIL || 'noreply@jobplatform.com'}>`,
        to: email,
        subject: `Job Alert: ${alertName} - New Matches Found`,
        html,
      });
    } catch (error) {
      console.error(`[JobAlert] Failed to send alert email to ${email}:`, error);
    }
  }
}

export default new JobAlertService();
