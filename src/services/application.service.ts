import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError';
import { ApplicationRepository } from '../repositories/application.repository';
import { JobRepository } from '../repositories/job.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';
import { UploadService } from './upload.service';
import { EmailService } from './email.service';
import {
  IApplication,
  ApplicationStatus,
  JobStatus,
  UserRole,
  NotificationType,
  PaginationOptions,
  PaginatedResult,
} from '../types';

interface ApplyData {
  jobId: string;
  applicantId: string;
  coverLetter?: string;
  resumePath?: string;
  resumePublicId?: string;
}

interface ApplicationListItem {
  hasResume: boolean;
  isPriority: boolean;
  [key: string]: unknown;
}

export class ApplicationService {
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly jobRepository: JobRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly analyticsService: AnalyticsService,
    private readonly uploadService: UploadService,
    private readonly emailService: EmailService,
  ) {}

  private sanitizeApplicationForEmployer(application: IApplication): ApplicationListItem {
    const obj = typeof application.toObject === 'function'
      ? application.toObject()
      : { ...(application as unknown as Record<string, unknown>) };

    const hasResume = !!(obj.resumePublicId || obj.resumePath);
    delete obj.resumePath;
    delete obj.resumePublicId;

    return { ...obj, hasResume, isPriority: false } as ApplicationListItem;
  }

  async applyToJob(data: ApplyData): Promise<IApplication> {
    const job = await this.jobRepository.findById(data.jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.status !== JobStatus.ACTIVE) {
      throw ApiError.badRequest('This job is not accepting applications');
    }

    if (job.applicationDeadline && new Date() > job.applicationDeadline) {
      throw ApiError.badRequest('Application deadline has passed');
    }

    const existingApplication = await this.applicationRepository.findExisting(data.jobId, data.applicantId);

    if (existingApplication) {
      throw ApiError.conflict('You have already applied to this job');
    }

    const employee = await this.userRepository.findEmployeeByIdSelect(
      data.applicantId,
      'resumePath resumePublicId',
    );

    const resumePath = data.resumePath || employee?.resumePath;
    const resumePublicId = data.resumePublicId
      || employee?.resumePublicId
      || this.uploadService.resolveResumePublicId(undefined, resumePath);

    const session = await mongoose.startSession();

    try {
      let application: IApplication;

      await session.withTransaction(async () => {
        application = await this.applicationRepository.create(
          {
            job: data.jobId,
            applicant: data.applicantId,
            coverLetter: data.coverLetter,
            resumePath,
            resumePublicId,
            status: ApplicationStatus.APPLIED,
            statusHistory: [
              {
                status: ApplicationStatus.APPLIED,
                changedAt: new Date(),
              },
            ],
          },
          session,
        );

        await this.jobRepository.incrementApplicationsCount(data.jobId, session);
        await this.analyticsService.trackApplication(data.jobId, session);
      });

      await this.notificationService.notifyNewApplication(
        job.employer.toString(),
        application!._id.toString(),
        job.title,
      );

      // Populate outside of session context to avoid expired session errors
      const populatedApplication = await this.applicationRepository.findById(application!._id.toString());
      return populatedApplication!.populate([
        { path: 'job', select: 'title company location' },
        { path: 'applicant', select: 'firstName lastName email' },
      ]);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw ApiError.conflict('You have already applied to this job');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getApplicationResumeDownloadUrl(
    applicationId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<{ url: string; expiresAt: number }> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    if (requesterRole === UserRole.EMPLOYEE) {
      if (application.applicant.toString() !== requesterId) {
        throw ApiError.forbidden('You can only download your own application resume');
      }
    } else if (requesterRole === UserRole.EMPLOYER) {
      const job = await this.jobRepository.findById(application.job.toString());
      if (!job) {
        throw ApiError.notFound('Associated job not found');
      }
      if (job.employer.toString() !== requesterId) {
        throw ApiError.forbidden('You can only download resumes for your own job applications');
      }
    } else {
      throw ApiError.forbidden('Access denied');
    }

    const publicId = this.uploadService.resolveResumePublicId(
      application.resumePublicId,
      application.resumePath,
    );

    if (!publicId) {
      throw ApiError.notFound('No resume attached to this application');
    }

    return this.uploadService.getSignedDownloadUrl(publicId, 'raw');
  }

  async getApplicationById(applicationId: string): Promise<IApplication> {
    const application = await this.applicationRepository.findByIdPopulated(applicationId);

    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    return application;
  }

  async getMyApplications(
    applicantId: string,
    options: PaginationOptions,
    status?: string,
  ): Promise<PaginatedResult<IApplication>> {
    return this.applicationRepository.findByApplicant(applicantId, options, status);
  }

  async getJobApplications(
    jobId: string,
    employerId: string,
    options: PaginationOptions,
    status?: string,
  ): Promise<PaginatedResult<ApplicationListItem>> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only view applications for your own jobs');
    }

    const result = await this.applicationRepository.findByJob(jobId, options, status);
    const applications = result.data;

    const applicantIds = applications.map(a => a.applicant?._id?.toString() || a.applicant?.toString());
    const premiumSubs = await this.applicationRepository.findPremiumSubscriptions(applicantIds);

    const premiumUserIds = new Set(premiumSubs.map(s => s.user.toString()));

    const sorted = [...applications].sort((a, b) => {
      const aId = a.applicant?._id?.toString() || a.applicant?.toString();
      const bId = b.applicant?._id?.toString() || b.applicant?.toString();
      const aIsPremium = premiumUserIds.has(aId);
      const bIsPremium = premiumUserIds.has(bId);
      if (aIsPremium && !bIsPremium) return -1;
      if (!aIsPremium && bIsPremium) return 1;
      return 0;
    });

    return {
      data: sorted.map((application) => {
        const applicantId = application.applicant?._id?.toString() || application.applicant?.toString();
        const sanitized = this.sanitizeApplicationForEmployer(application);
        sanitized.isPriority = premiumUserIds.has(applicantId);
        return sanitized;
      }),
      pagination: result.pagination,
    };
  }

  async getRecentEmployerApplications(
    employerId: string,
    limit: number,
  ): Promise<ApplicationListItem[]> {
    const jobIds = await this.jobRepository.findIdsByEmployer(employerId);
    if (jobIds.length === 0) return [];

    const applications = await this.applicationRepository.findRecentByJobs(jobIds, limit);

    const applicantIds = applications.map(a => a.applicant?._id?.toString() || a.applicant?.toString());
    const premiumSubs = await this.applicationRepository.findPremiumSubscriptions(applicantIds);
    const premiumUserIds = new Set(premiumSubs.map(s => s.user.toString()));

    return applications.map((application) => {
      const applicantId = application.applicant?._id?.toString() || application.applicant?.toString();
      const sanitized = this.sanitizeApplicationForEmployer(application);
      sanitized.isPriority = premiumUserIds.has(applicantId);
      return sanitized;
    });
  }

  async updateApplicationStatus(
    applicationId: string,
    employerId: string,
    newStatus: ApplicationStatus,
    note?: string,
  ): Promise<IApplication> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    const job = await this.jobRepository.findById(application.job.toString());
    if (!job) {
      throw ApiError.notFound('Associated job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only update applications for your own jobs');
    }

    application.status = newStatus;
    application.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      note,
    });

    await application.save();

    await this.notificationService.notifyApplicationStatusChange(
      application.applicant.toString(),
      application._id.toString(),
      newStatus,
      job.title,
    );

    // Send interview invite email if status is interview and note contains details
    if (newStatus === ApplicationStatus.INTERVIEW && note) {
      const applicant = await this.userRepository.findEmployeeByIdSelect(
        application.applicant.toString(),
        'firstName lastName email',
      );
      const company = await job.populate('company', 'name');
      const companyName = (company.company as any)?.name || 'the company';

      if (applicant?.email) {
        // Parse interview details from note
        const dateTimeLine = note.match(/Date:\s*(.+)/)?.[1]?.trim() || '';
        const [datePart, timePart] = dateTimeLine.split(' at ').map(s => s.trim());
        const typeMatch = note.match(/Type:\s*(.+)/);
        const linkMatch = note.match(/Meeting Link:\s*(.+)/);
        const locationMatch = note.match(/Location:\s*(.+)/);
        const notesMatch = note.match(/Notes:\s*(.+)/);

        this.emailService.sendInterviewInvite({
          email: applicant.email,
          firstName: applicant.firstName,
          jobTitle: job.title,
          companyName,
          date: datePart || '',
          time: timePart || '',
          type: typeMatch?.[1]?.toLowerCase().includes('video') ? 'video'
            : typeMatch?.[1]?.toLowerCase().includes('in-person') ? 'in-person' : 'phone',
          meetingLink: linkMatch?.[1]?.trim(),
          location: locationMatch?.[1]?.trim(),
          notes: notesMatch?.[1]?.trim(),
        });
      }
    }

    // Send email for offer status
    if (newStatus === ApplicationStatus.OFFER) {
      const applicant = await this.userRepository.findEmployeeByIdSelect(
        application.applicant.toString(),
        'firstName lastName email',
      );
      if (applicant?.email) {
        this.emailService.sendApplicationStatusUpdate(
          applicant.email,
          applicant.firstName,
          job.title,
          'offer',
        );
      }
    }

    return application.populate([
      { path: 'job', select: 'title company location' },
      { path: 'applicant', select: 'firstName lastName email' },
    ]);
  }

  async withdrawApplication(applicationId: string, applicantId: string): Promise<IApplication> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    if (application.applicant.toString() !== applicantId) {
      throw ApiError.forbidden('You can only withdraw your own applications');
    }

    if (application.status === ApplicationStatus.WITHDRAWN) {
      throw ApiError.badRequest('Application is already withdrawn');
    }

    application.status = ApplicationStatus.WITHDRAWN;
    application.statusHistory.push({
      status: ApplicationStatus.WITHDRAWN,
      changedAt: new Date(),
      note: 'Withdrawn by applicant',
    });

    await application.save();

    const job = await this.jobRepository.findById(application.job.toString());
    if (job) {
      const applicant = await this.userRepository.findEmployeeByIdSelect(applicantId, 'firstName lastName');
      const applicantName = applicant ? `${applicant.firstName} ${applicant.lastName}` : 'A candidate';

      await this.notificationService.createNotification({
        recipient: job.employer.toString(),
        recipientRole: UserRole.EMPLOYER,
        type: NotificationType.APPLICATION_STATUS_CHANGED,
        title: 'Application Withdrawn',
        message: `${applicantName} has withdrawn their application for "${job.title}"`,
        relatedId: application._id.toString(),
        relatedModel: 'Application',
      });
    }

    return application;
  }
}
