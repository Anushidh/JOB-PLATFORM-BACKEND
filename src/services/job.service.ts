import Job from '../models/Job';
import { ApiError } from '../utils/apiError';
import { IJob, JobStatus, PaginationOptions, PaginatedResult } from '../types';
import jobAlertService from './jobAlert.service';
import JobAnalytics from '../models/JobAnalytics';

interface JobFilters {
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
}

class JobService {
  /** Creates a new job posting and populates company/employer references */
  async createJob(jobData: Partial<IJob>): Promise<IJob> {
    const job = await Job.create(jobData);
    return job.populate(['company', 'employer']);
  }

  /** Fetches a single job with populated company and employer details */
  async getJobById(jobId: string): Promise<IJob> {
    const job = await Job.findById(jobId)
      .populate('company', 'name logoUrl website industry size location')
      .populate('employer', 'firstName lastName email');

    if (!job) {
      throw ApiError.notFound('Job not found');
    }
    return job;
  }

  /** Updates job fields (excluding status, employer, and company) after verifying ownership */
  async updateJob(jobId: string, employerId: string, updateData: Partial<IJob>): Promise<IJob> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only update your own jobs');
    }

    // Don't allow direct status changes through update (use dedicated methods)
    delete updateData.status;
    delete (updateData as any).employer;
    delete (updateData as any).company;

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('company', 'name logoUrl website industry size location')
      .populate('employer', 'firstName lastName email');

    return updatedJob!;
  }

  /** Soft-deletes a job by marking it as deleted and closing it */
  async deleteJob(jobId: string, employerId: string): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only delete your own jobs');
    }

    job.isDeleted = true;
    job.deletedAt = new Date();
    job.status = JobStatus.CLOSED;
    await job.save();
  }

  /** Changes job status (draft/active/closed only) and triggers instant alerts when activated */
  async changeJobStatus(jobId: string, employerId: string, status: JobStatus): Promise<IJob> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only modify your own jobs');
    }

    // Employers can only set to draft, active, or closed
    const allowedStatuses = [JobStatus.DRAFT, JobStatus.ACTIVE, JobStatus.CLOSED];
    if (!allowedStatuses.includes(status)) {
      throw ApiError.badRequest(`Invalid status transition. Allowed: ${allowedStatuses.join(', ')}`);
    }

    job.status = status;
    await job.save();

    // Trigger instant job alerts when job becomes active
    if (status === JobStatus.ACTIVE) {
      jobAlertService.checkInstantAlerts(job._id.toString()).catch((err) =>
        console.error('[JobAlert] Error checking instant alerts:', err)
      );
    }

    return job.populate(['company', 'employer']);
  }

  /** Returns paginated jobs filtered by search, location, type, skills, salary, etc. */
  async getJobs(
    filters: JobFilters,
    options: PaginationOptions
  ): Promise<PaginatedResult<IJob>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };

    // Only show active jobs to public
    if (filters.status) {
      query.status = filters.status;
    } else {
      query.status = JobStatus.ACTIVE;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    if (filters.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    if (filters.jobType) {
      query.jobType = filters.jobType;
    }

    if (filters.workMode) {
      query.workMode = filters.workMode;
    }

    if (filters.experienceLevel) {
      query.experienceLevel = filters.experienceLevel;
    }

    if (filters.skills && filters.skills.length > 0) {
      query.skillsRequired = { $in: filters.skills };
    }

    if (filters.salaryMin) {
      query.salaryMax = { $gte: filters.salaryMin };
    }

    if (filters.salaryMax) {
      query.salaryMin = { ...query.salaryMin, $lte: filters.salaryMax };
    }

    if (filters.employer) {
      query.employer = filters.employer;
    }

    if (filters.company) {
      query.company = filters.company;
    }

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('company', 'name logoUrl industry location')
        .populate('employer', 'firstName lastName')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(query),
    ]);

    return {
      data: jobs,
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

  /** Returns paginated jobs belonging to a specific employer, optionally filtered by status */
  async getEmployerJobs(
    employerId: string,
    options: PaginationOptions,
    status?: string
  ): Promise<PaginatedResult<IJob>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = { employer: employerId, isDeleted: false };
    if (status) {
      query.status = status;
    }

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('company', 'name logoUrl')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(query),
    ]);

    return {
      data: jobs,
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

  /** Returns up to 5 similar jobs based on matching skills, location, and job type */
  async getSimilarJobs(jobId: string): Promise<IJob[]> {
    const job = await Job.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');

    const similar = await Job.find({
      _id: { $ne: jobId },
      isDeleted: false,
      status: JobStatus.ACTIVE,
      $or: [
        { skillsRequired: { $in: job.skillsRequired } },
        { location: job.location },
        { jobType: job.jobType },
      ],
    })
      .limit(5)
      .populate('company', 'name logoUrl')
      .select('title company location jobType workMode salaryMin salaryMax experienceLevel createdAt');

    return similar;
  }

  /** Records a job view for the user and stores in Redis (last 10) */
  async recordRecentView(userId: string, jobId: string): Promise<void> {
    const redis = (await import('../config/redis')).default;
    const key = `recent_views:${userId}`;
    // Remove if already exists (to re-add at front)
    await redis.lrem(key, 0, jobId);
    // Push to front
    await redis.lpush(key, jobId);
    // Trim to 10
    await redis.ltrim(key, 0, 9);
    // Expire after 30 days
    await redis.expire(key, 30 * 24 * 60 * 60);
  }

  /** Returns the last 10 jobs viewed by the user */
  async getRecentlyViewed(userId: string): Promise<IJob[]> {
    const redis = (await import('../config/redis')).default;
    const key = `recent_views:${userId}`;
    const jobIds = await redis.lrange(key, 0, 9);

    if (jobIds.length === 0) return [];

    const jobs = await Job.find({ _id: { $in: jobIds }, isDeleted: false })
      .populate('company', 'name logoUrl')
      .select('title company location jobType workMode salaryMin salaryMax experienceLevel createdAt');

    // Maintain Redis order
    const jobMap = new Map(jobs.map(j => [j._id.toString(), j]));
    return jobIds.map(id => jobMap.get(id)).filter(Boolean) as IJob[];
  }

  /** Returns quick stats for a job (for employer dashboard cards) */
  async getJobQuickStats(jobId: string, employerId: string): Promise<{ totalApplications: number; todayViews: number; totalViews: number }> {
    const job = await Job.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    if (job.employer.toString() !== employerId) throw ApiError.forbidden('Not your job');

    const analytics = await JobAnalytics.findOne({ job: jobId });

    let todayViews = 0;
    if (analytics) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStat = analytics.dailyStats.find(s => s.date.getTime() === today.getTime());
      todayViews = todayStat?.views || 0;
    }

    return {
      totalApplications: job.applicationsCount,
      todayViews,
      totalViews: analytics?.views || 0,
    };
  }
}

export default new JobService();
