import type { ClientSession } from 'mongoose';
import Application from '../models/Application';
import Subscription, { PlanType, SubscriptionStatus } from '../models/Subscription';
import { IApplication, PaginationOptions, PaginatedResult } from '../types';

export class ApplicationRepository {
  constructor(
    private readonly applicationModel: typeof Application = Application,
    private readonly subscriptionModel: typeof Subscription = Subscription,
  ) {}

  findExisting(jobId: string, applicantId: string) {
    return this.applicationModel.findOne({ job: jobId, applicant: applicantId });
  }

  create(data: Record<string, unknown>, session?: ClientSession) {
    if (session) {
      return this.applicationModel.create([data], { session }).then((docs) => docs[0]);
    }
    return this.applicationModel.create(data);
  }

  findById(applicationId: string) {
    return this.applicationModel.findById(applicationId);
  }

  findByIdPopulated(applicationId: string) {
    return this.applicationModel.findById(applicationId)
      .populate({
        path: 'job',
        select: 'title company location employer',
        populate: { path: 'company', select: 'name logoUrl' },
      })
      .populate({
        path: 'applicant',
        select: 'firstName lastName email phone skills avatar bio headline',
      });
  }

  async findByApplicant(
    applicantId: string,
    options: PaginationOptions,
    status?: string,
  ): Promise<PaginatedResult<IApplication>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { applicant: applicantId };
    if (status) query.status = status;

    const [applications, total] = await Promise.all([
      this.applicationModel.find(query)
        .populate({
          path: 'job',
          select: 'title company location jobType workMode',
          populate: { path: 'company', select: 'name logoUrl' },
        })
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.applicationModel.countDocuments(query),
    ]);

    return {
      data: applications,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findByJob(
    jobId: string,
    options: PaginationOptions,
    status?: string,
  ): Promise<PaginatedResult<IApplication>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { job: jobId };
    if (status) query.status = status;

    const [applications, total] = await Promise.all([
      this.applicationModel.find(query)
        .populate({
          path: 'applicant',
          select: 'firstName lastName email phone skills avatar bio headline',
        })
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.applicationModel.countDocuments(query),
    ]);

    return {
      data: applications,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  findPremiumSubscriptions(applicantIds: string[]) {
    return this.subscriptionModel.find({
      user: { $in: applicantIds },
      status: SubscriptionStatus.ACTIVE,
      plan: { $in: [PlanType.PREMIUM, PlanType.ENTERPRISE] },
      endDate: { $gte: new Date() },
    }).select('user');
  }

  countDocuments(filter: Record<string, unknown> = {}) {
    return this.applicationModel.countDocuments(filter);
  }

  countApplicationsThisMonth(applicantId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.applicationModel.countDocuments({
      applicant: applicantId,
      createdAt: { $gte: startOfMonth },
    });
  }
}
