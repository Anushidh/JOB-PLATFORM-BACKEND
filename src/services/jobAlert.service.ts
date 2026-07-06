import { ApiError } from '../utils/apiError';
import { JobAlertRepository } from '../repositories/jobAlert.repository';
import { JobRepository } from '../repositories/job.repository';
import { IJobAlert } from '../models/JobAlert';
import { JobStatus } from '../types';

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

export class JobAlertService {
  constructor(
    private readonly jobAlertRepository: JobAlertRepository,
    private readonly jobRepository: JobRepository,
  ) {}

  async createAlert(employeeId: string, data: AlertData): Promise<IJobAlert> {
    const alertCount = await this.jobAlertRepository.countByEmployee(employeeId);
    if (alertCount >= MAX_ALERTS_PER_USER) {
      throw ApiError.badRequest(`You can have a maximum of ${MAX_ALERTS_PER_USER} job alerts`);
    }

    return this.jobAlertRepository.create({
      employee: employeeId,
      name: data.name,
      filters: data.filters,
      frequency: data.frequency,
      isActive: true,
    });
  }

  async updateAlert(alertId: string, employeeId: string, data: Partial<AlertData>): Promise<IJobAlert> {
    const alert = await this.jobAlertRepository.findByIdAndEmployee(alertId, employeeId);
    if (!alert) {
      throw ApiError.notFound('Job alert not found');
    }

    if (data.name) alert.name = data.name;
    if (data.filters) alert.filters = { ...alert.filters, ...data.filters };
    if (data.frequency) alert.frequency = data.frequency;

    await alert.save();
    return alert;
  }

  async deleteAlert(alertId: string, employeeId: string): Promise<void> {
    const alert = await this.jobAlertRepository.findByIdAndEmployee(alertId, employeeId);
    if (!alert) {
      throw ApiError.notFound('Job alert not found');
    }

    await this.jobAlertRepository.deleteById(alertId);
  }

  async getMyAlerts(employeeId: string): Promise<IJobAlert[]> {
    return this.jobAlertRepository.findByEmployee(employeeId);
  }

  async toggleAlert(alertId: string, employeeId: string): Promise<IJobAlert> {
    const alert = await this.jobAlertRepository.findByIdAndEmployee(alertId, employeeId);
    if (!alert) {
      throw ApiError.notFound('Job alert not found');
    }

    alert.isActive = !alert.isActive;
    await alert.save();
    return alert;
  }

  private buildJobQuery(filters: IJobAlert['filters'], since?: Date) {
    const query: Record<string, unknown> = { status: JobStatus.ACTIVE };

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

  async checkAndSendAlerts(): Promise<void> {
    const now = new Date();

    const alerts = await this.jobAlertRepository.findActiveByFrequency(['daily', 'weekly']);

    for (const alert of alerts) {
      try {
        if (alert.lastSentAt) {
          const hoursSinceLastSent = (now.getTime() - alert.lastSentAt.getTime()) / (1000 * 60 * 60);
          if (alert.frequency === 'daily' && hoursSinceLastSent < 24) continue;
          if (alert.frequency === 'weekly' && hoursSinceLastSent < 168) continue;
        }

        const since = alert.lastSentAt || new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const query = this.buildJobQuery(alert.filters, since);
        const matchingJobs = await this.jobRepository.findMatching(query, since, 10);

        if (matchingJobs.length > 0) {
          const employee = alert.employee as unknown as { email: string; firstName: string };
          await this.sendAlertEmail(
            employee.email,
            employee.firstName,
            alert.name,
            matchingJobs,
          );
        }

        alert.lastSentAt = now;
        await alert.save();
      } catch (error) {
        console.error(`[JobAlert] Error processing alert ${alert._id}:`, error);
      }
    }
  }

  async checkInstantAlerts(jobId: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job || job.status !== JobStatus.ACTIVE) return;

    const alerts = await this.jobAlertRepository.findActiveInstant();

    for (const alert of alerts) {
      try {
        const query = this.buildJobQuery(alert.filters);
        const matchingJob = await this.jobRepository.findOneMatching(jobId, query);

        if (matchingJob) {
          const employee = alert.employee as unknown as { email: string; firstName: string };
          await this.sendAlertEmail(
            employee.email,
            employee.firstName,
            alert.name,
            [matchingJob],
          );

          alert.lastSentAt = new Date();
          await alert.save();
        }
      } catch (error) {
        console.error(`[JobAlert] Error processing instant alert ${alert._id}:`, error);
      }
    }
  }

  private async sendAlertEmail(
    email: string,
    firstName: string,
    alertName: string,
    jobs: { title: string; location: string; jobType: string }[],
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

    try {
      const sgMail = (await import('@sendgrid/mail')).default;
      sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
      const fromName = process.env.SMTP_FROM_NAME || 'HireFlow';
      const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@hireflow.dev';

      await sgMail.send({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: `Job Alert: ${alertName} - New Matches Found`,
        html,
      });
    } catch (error) {
      console.error(`[JobAlert] Failed to send alert email to ${email}:`, error);
    }
  }
}
