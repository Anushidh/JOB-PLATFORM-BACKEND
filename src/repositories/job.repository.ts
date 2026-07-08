import type { ClientSession } from 'mongoose';
import Job from '../models/Job';
import JobAnalytics from '../models/JobAnalytics';
import { IJob, JobStatus, PaginationOptions, PaginatedResult } from '../types';

export interface JobFilters {
  search?: string;
  location?: string;
  jobType?: string;
  workMode?: string;
  experienceLevel?: string;
  skills?: string[];
  salaryMin?: number;
  salaryMax?: number;
  status?: string;
  employer?: string;
  company?: string;
  companies?: string[];
}

export class JobRepository {
  constructor(
    private readonly jobModel: typeof Job = Job,
    private readonly jobAnalyticsModel: typeof JobAnalytics = JobAnalytics,
  ) {}

  create(jobData: Partial<IJob>) {
    return this.jobModel.create(jobData);
  }

  findById(jobId: string) {
    return this.jobModel.findById(jobId);
  }

  findByIdPopulated(jobId: string) {
    return this.jobModel.findById(jobId)
      .populate('company', 'name logoUrl website industry size location')
      .populate('employer', 'firstName lastName email');
  }

  findByIdAndUpdate(jobId: string, updateData: Partial<IJob>) {
    return this.jobModel.findByIdAndUpdate(
      jobId,
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .populate('company', 'name logoUrl website industry size location')
      .populate('employer', 'firstName lastName email');
  }

  incrementApplicationsCount(jobId: string, session?: ClientSession) {
    return this.jobModel.findByIdAndUpdate(
      jobId,
      { $inc: { applicationsCount: 1 } },
      session ? { session } : undefined,
    );
  }

  findSimilar(jobId: string, skillsRequired: string[], location: string, jobType: string) {
    return this.jobModel.find({
      _id: { $ne: jobId },
      isDeleted: false,
      status: JobStatus.ACTIVE,
      $or: [
        { skillsRequired: { $in: skillsRequired } },
        { location },
        { jobType },
      ],
    })
      .limit(5)
      .populate('company', 'name logoUrl')
      .select('title company location jobType workMode salaryMin salaryMax experienceLevel createdAt');
  }

  findByIds(jobIds: string[]) {
    return this.jobModel.find({ _id: { $in: jobIds }, isDeleted: false })
      .populate('company', 'name logoUrl')
      .select('title company location jobType workMode salaryMin salaryMax experienceLevel createdAt');
  }

  async findJobs(filters: JobFilters, options: PaginationOptions): Promise<PaginatedResult<IJob>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { isDeleted: false };

    if (filters.status) {
      query.status = filters.status;
    } else {
      query.status = JobStatus.ACTIVE;
    }

    if (filters.search) query.$text = { $search: filters.search };
    if (filters.location) query.location = { $regex: filters.location, $options: 'i' };
    if (filters.jobType) query.jobType = filters.jobType;
    if (filters.workMode) query.workMode = filters.workMode;
    if (filters.experienceLevel) query.experienceLevel = filters.experienceLevel;
    if (filters.skills && filters.skills.length > 0) query.skillsRequired = { $in: filters.skills };
    if (filters.salaryMin) query.salaryMax = { $gte: filters.salaryMin };
    if (filters.salaryMax) query.salaryMin = { ...(query.salaryMin as object || {}), $lte: filters.salaryMax };
    if (filters.employer) query.employer = filters.employer;
    if (filters.company) query.company = filters.company;
    if (filters.companies && filters.companies.length > 0) {
      query.company = { $in: filters.companies };
    }

    const [jobs, total] = await Promise.all([
      this.jobModel.find(query)
        .populate('company', 'name logoUrl industry location')
        .populate('employer', 'firstName lastName')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.jobModel.countDocuments(query),
    ]);

    return {
      data: jobs,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findByEmployer(
    employerId: string,
    options: PaginationOptions,
    status?: string,
  ): Promise<PaginatedResult<IJob>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { employer: employerId, isDeleted: false };
    if (status) query.status = status;

    const [jobs, total] = await Promise.all([
      this.jobModel.find(query)
        .populate('company', 'name logoUrl')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.jobModel.countDocuments(query),
    ]);

    return {
      data: jobs,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findIdsByEmployer(employerId: string): Promise<string[]> {
    const jobs = await this.jobModel.find({ employer: employerId }).select('_id');
    return jobs.map(j => j._id.toString());
  }

  findAnalyticsByJob(jobId: string) {
    return this.jobAnalyticsModel.findOne({ job: jobId });
  }

  countByEmployerAndStatus(employerId: string, statuses: JobStatus[]) {
    return this.jobModel.countDocuments({
      employer: employerId,
      isDeleted: false,
      status: { $in: statuses },
    });
  }

  softDeleteByEmployer(employerId: string) {
    return this.jobModel.updateMany(
      { employer: employerId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), status: JobStatus.CLOSED },
    );
  }

  async findPending(options: PaginationOptions): Promise<PaginatedResult<IJob>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;
    const query = { status: JobStatus.PENDING };

    const [jobs, total] = await Promise.all([
      this.jobModel.find(query)
        .populate('company', 'name logoUrl')
        .populate('employer', 'firstName lastName email')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.jobModel.countDocuments(query),
    ]);

    return {
      data: jobs,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  countDocuments(filter: Record<string, unknown> = {}) {
    return this.jobModel.countDocuments(filter);
  }

  countActiveJobPostsByEmployer(employerId: string) {
    return this.jobModel.countDocuments({
      employer: employerId,
      isDeleted: false,
      status: { $ne: JobStatus.CLOSED },
    });
  }

  findByEmployerSelect(employerId: string, select: string) {
    return this.jobModel.find({ employer: employerId }).select(select);
  }

  closeExpiredJobs(now: Date) {
    return this.jobModel.updateMany(
      {
        status: JobStatus.ACTIVE,
        isDeleted: false,
        applicationDeadline: { $lt: now, $ne: null },
      },
      { status: JobStatus.CLOSED },
    );
  }

  findMatching(query: Record<string, unknown>, since?: Date, limit?: number) {
    const q = { ...query };
    if (since) q.createdAt = { $gte: since };
    let queryBuilder = this.jobModel.find(q);
    if (limit) queryBuilder = queryBuilder.limit(limit);
    return queryBuilder.select('title company location jobType');
  }

  findOneMatching(jobId: string, query: Record<string, unknown>) {
    return this.jobModel.findOne({ _id: jobId, ...query });
  }
}
