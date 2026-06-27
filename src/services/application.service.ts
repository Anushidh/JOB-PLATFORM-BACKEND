import Application from '../models/Application';
import Job from '../models/Job';
import { ApiError } from '../utils/apiError';
import { IApplication, ApplicationStatus, JobStatus, UserRole, NotificationType, PaginationOptions, PaginatedResult } from '../types';
import notificationService from './notification.service';
import analyticsService from './analytics.service';

interface ApplyData {
  jobId: string;
  applicantId: string;
  coverLetter?: string;
  resumePath?: string;
}

class ApplicationService {
  /** Submits an application to a job, increments job applicationsCount, tracks analytics, and notifies the employer */
  async applyToJob(data: ApplyData): Promise<IApplication> {
    const job = await Job.findById(data.jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.status !== JobStatus.ACTIVE) {
      throw ApiError.badRequest('This job is not accepting applications');
    }

    if (job.applicationDeadline && new Date() > job.applicationDeadline) {
      throw ApiError.badRequest('Application deadline has passed');
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: data.jobId,
      applicant: data.applicantId,
    });

    if (existingApplication) {
      throw ApiError.conflict('You have already applied to this job');
    }

    const application = await Application.create({
      job: data.jobId,
      applicant: data.applicantId,
      coverLetter: data.coverLetter,
      resumePath: data.resumePath,
      status: ApplicationStatus.APPLIED,
      statusHistory: [
        {
          status: ApplicationStatus.APPLIED,
          changedAt: new Date(),
        },
      ],
    });

    // Increment applications count on job
    await Job.findByIdAndUpdate(data.jobId, {
      $inc: { applicationsCount: 1 },
    });

    // Track application in analytics
    await analyticsService.trackApplication(data.jobId);

    // Notify employer
    await notificationService.notifyNewApplication(
      job.employer.toString(),
      application._id.toString(),
      job.title
    );

    return application.populate([
      { path: 'job', select: 'title company location' },
      { path: 'applicant', select: 'firstName lastName email', model: 'Employee' },
    ]);
  }

  /** Fetches a single application with populated job and applicant details */
  async getApplicationById(applicationId: string): Promise<IApplication> {
    const application = await Application.findById(applicationId)
      .populate({
        path: 'job',
        select: 'title company location employer',
        populate: { path: 'company', select: 'name logoUrl' },
      })
      .populate({
        path: 'applicant',
        select: 'firstName lastName email phone skills resumePath',
        model: 'Employee',
      });

    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    return application;
  }

  /** Returns paginated applications submitted by the given applicant, optionally filtered by status */
  async getMyApplications(
    applicantId: string,
    options: PaginationOptions,
    status?: string
  ): Promise<PaginatedResult<IApplication>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = { applicant: applicantId };
    if (status) {
      query.status = status;
    }

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate({
          path: 'job',
          select: 'title company location jobType workMode',
          populate: { path: 'company', select: 'name logoUrl' },
        })
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query),
    ]);

    return {
      data: applications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /** Returns paginated applications for a specific job, verifying the employer owns the job. Premium applicants are shown first. */
  async getJobApplications(
    jobId: string,
    employerId: string,
    options: PaginationOptions,
    status?: string
  ): Promise<PaginatedResult<IApplication>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Verify that employer owns the job
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only view applications for your own jobs');
    }

    const query: any = { job: jobId };
    if (status) {
      query.status = status;
    }

    // Get all applications
    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate({
          path: 'applicant',
          select: 'firstName lastName email phone skills resumePath avatar bio headline',
          model: 'Employee',
        })
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query),
    ]);

    // Sort premium applicants first (those with active Premium/Enterprise subscriptions)
    const Subscription = (await import('../models/Subscription')).default;
    const { SubscriptionStatus, PlanType } = await import('../models/Subscription');

    const applicantIds = applications.map(a => a.applicant?._id?.toString() || a.applicant?.toString());
    const premiumSubs = await Subscription.find({
      user: { $in: applicantIds },
      status: SubscriptionStatus.ACTIVE,
      plan: { $in: [PlanType.PREMIUM, PlanType.ENTERPRISE] },
      endDate: { $gte: new Date() },
    }).select('user');

    const premiumUserIds = new Set(premiumSubs.map(s => s.user.toString()));

    // Sort: premium applicants first, then by original sort order
    const sorted = [...applications].sort((a, b) => {
      const aId = a.applicant?._id?.toString() || a.applicant?.toString();
      const bId = b.applicant?._id?.toString() || b.applicant?.toString();
      const aIsPremium = premiumUserIds.has(aId);
      const bIsPremium = premiumUserIds.has(bId);
      if (aIsPremium && !bIsPremium) return -1;
      if (!aIsPremium && bIsPremium) return 1;
      return 0; // maintain original order for same tier
    });

    return {
      data: sorted,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /** Updates application status, records it in status history, and notifies the applicant */
  async updateApplicationStatus(
    applicationId: string,
    employerId: string,
    newStatus: ApplicationStatus,
    note?: string
  ): Promise<IApplication> {
    const application = await Application.findById(applicationId);
    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    const job = await Job.findById(application.job);
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

    // Notify applicant about status change
    await notificationService.notifyApplicationStatusChange(
      application.applicant.toString(),
      application._id.toString(),
      newStatus,
      job.title
    );

    return application.populate([
      { path: 'job', select: 'title company location' },
      { path: 'applicant', select: 'firstName lastName email', model: 'Employee' },
    ]);
  }

  /** Allows an applicant to withdraw their own application. Notifies the employer. */
  async withdrawApplication(applicationId: string, applicantId: string): Promise<IApplication> {
    const application = await Application.findById(applicationId);
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

    // Notify the employer about the withdrawal
    const job = await Job.findById(application.job);
    if (job) {
      const Employee = (await import('../models/Employee')).default;
      const applicant = await Employee.findById(applicantId).select('firstName lastName');
      const applicantName = applicant ? `${applicant.firstName} ${applicant.lastName}` : 'A candidate';

      await notificationService.createNotification({
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

export default new ApplicationService();
