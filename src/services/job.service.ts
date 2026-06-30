import type Redis from 'ioredis';
import { ApiError } from '../utils/apiError';
import { JobRepository, JobFilters } from '../repositories/job.repository';
import { JobAlertService } from './jobAlert.service';
import { IJob, JobStatus, PaginationOptions, PaginatedResult } from '../types';

export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobAlertService: JobAlertService,
    private readonly redis: Redis,
  ) {}

  async createJob(jobData: Partial<IJob>): Promise<IJob> {
    const job = await this.jobRepository.create(jobData);
    return job.populate(['company', 'employer']);
  }

  async getJobById(jobId: string): Promise<IJob> {
    const job = await this.jobRepository.findByIdPopulated(jobId);

    if (!job) {
      throw ApiError.notFound('Job not found');
    }
    return job;
  }

  async updateJob(jobId: string, employerId: string, updateData: Partial<IJob>): Promise<IJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only update your own jobs');
    }

    delete updateData.status;
    delete (updateData as Record<string, unknown>).employer;
    delete (updateData as Record<string, unknown>).company;

    const updatedJob = await this.jobRepository.findByIdAndUpdate(jobId, updateData);

    return updatedJob!;
  }

  async deleteJob(jobId: string, employerId: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
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

  async changeJobStatus(jobId: string, employerId: string, status: JobStatus): Promise<IJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You can only modify your own jobs');
    }

    const allowedStatuses = [JobStatus.DRAFT, JobStatus.ACTIVE, JobStatus.CLOSED];
    if (!allowedStatuses.includes(status)) {
      throw ApiError.badRequest(`Invalid status transition. Allowed: ${allowedStatuses.join(', ')}`);
    }

    job.status = status;
    await job.save();

    if (status === JobStatus.ACTIVE) {
      this.jobAlertService.checkInstantAlerts(job._id.toString()).catch((err) =>
        console.error('[JobAlert] Error checking instant alerts:', err),
      );
    }

    return job.populate(['company', 'employer']);
  }

  async getJobs(
    filters: JobFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IJob>> {
    return this.jobRepository.findJobs(filters, options);
  }

  async getEmployerJobs(
    employerId: string,
    options: PaginationOptions,
    status?: string,
  ): Promise<PaginatedResult<IJob>> {
    return this.jobRepository.findByEmployer(employerId, options, status);
  }

  async getSimilarJobs(jobId: string): Promise<IJob[]> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');

    return this.jobRepository.findSimilar(
      jobId,
      job.skillsRequired,
      job.location,
      job.jobType,
    );
  }

  async recordRecentView(userId: string, jobId: string): Promise<void> {
    const key = `recent_views:${userId}`;
    await this.redis.lrem(key, 0, jobId);
    await this.redis.lpush(key, jobId);
    await this.redis.ltrim(key, 0, 9);
    await this.redis.expire(key, 30 * 24 * 60 * 60);
  }

  async getRecentlyViewed(userId: string): Promise<IJob[]> {
    const key = `recent_views:${userId}`;
    const jobIds = await this.redis.lrange(key, 0, 9);

    if (jobIds.length === 0) return [];

    const jobs = await this.jobRepository.findByIds(jobIds);

    const jobMap = new Map(jobs.map(j => [j._id.toString(), j]));
    return jobIds.map(id => jobMap.get(id)).filter(Boolean) as IJob[];
  }

  async getJobQuickStats(jobId: string, employerId: string): Promise<{ totalApplications: number; todayViews: number; totalViews: number }> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    if (job.employer.toString() !== employerId) throw ApiError.forbidden('Not your job');

    const analytics = await this.jobRepository.findAnalyticsByJob(jobId);

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

export type { JobFilters };
