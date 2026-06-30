import mongoose, { type ClientSession } from 'mongoose';
import { ApiError } from '../utils/apiError';
import { JobAnalyticsRepository } from '../repositories/jobAnalytics.repository';
import { JobRepository } from '../repositories/job.repository';
import { IJobAnalytics } from '../models/JobAnalytics';

export class AnalyticsService {
  constructor(
    private readonly jobAnalyticsRepository: JobAnalyticsRepository,
    private readonly jobRepository: JobRepository,
  ) {}

  private getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private async updateDailyStat(
    analytics: IJobAnalytics,
    field: 'views' | 'clicks' | 'applications',
    session?: ClientSession,
  ): Promise<void> {
    const today = this.getTodayStart();
    const dailyStat = analytics.dailyStats.find(
      (stat) => stat.date.getTime() === today.getTime(),
    );

    if (dailyStat) {
      dailyStat[field] += 1;
    } else {
      analytics.dailyStats.push({
        date: today,
        views: field === 'views' ? 1 : 0,
        clicks: field === 'clicks' ? 1 : 0,
        applications: field === 'applications' ? 1 : 0,
      });
    }

    await analytics.save(session ? { session } : undefined);
  }

  async trackView(jobId: string, viewerId?: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const analytics = await this.jobAnalyticsRepository.getOrCreate(jobId);

    analytics.views += 1;

    if (viewerId) {
      const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
      const alreadyViewed = analytics.viewedBy.some(
        (id) => id.toString() === viewerId,
      );
      if (!alreadyViewed) {
        analytics.viewedBy.push(viewerObjectId);
        analytics.uniqueViews += 1;
      }
    }

    await analytics.save();
    await this.updateDailyStat(analytics, 'views');
  }

  async trackClick(jobId: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const analytics = await this.jobAnalyticsRepository.getOrCreate(jobId);
    analytics.clicks += 1;
    await analytics.save();
    await this.updateDailyStat(analytics, 'clicks');
  }

  async trackApplication(jobId: string, session?: ClientSession): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const analytics = await this.jobAnalyticsRepository.getOrCreate(jobId, session);
    analytics.applications += 1;
    await analytics.save(session ? { session } : undefined);
    await this.updateDailyStat(analytics, 'applications', session);
  }

  async getJobAnalytics(jobId: string, employerId: string): Promise<IJobAnalytics | null> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You do not have access to this job\'s analytics');
    }

    const analytics = await this.jobAnalyticsRepository.findByJob(jobId);
    if (!analytics) {
      return this.jobAnalyticsRepository.getOrCreate(jobId);
    }

    return analytics;
  }

  async getEmployerDashboardAnalytics(employerId: string): Promise<{
    totalJobs: number;
    totalViews: number;
    totalUniqueViews: number;
    totalClicks: number;
    totalApplications: number;
    clickThroughRate: number;
    applicationRate: number;
    jobStats: { jobId: string; title: string; views: number; clicks: number; applications: number }[];
  }> {
    const jobs = await this.jobRepository.findByEmployerSelect(employerId, '_id title');

    if (jobs.length === 0) {
      return {
        totalJobs: 0,
        totalViews: 0,
        totalUniqueViews: 0,
        totalClicks: 0,
        totalApplications: 0,
        clickThroughRate: 0,
        applicationRate: 0,
        jobStats: [],
      };
    }

    const jobIds = jobs.map((job) => job._id);

    const aggregation = await this.jobAnalyticsRepository.aggregateByJobs(jobIds);

    const totals = aggregation[0] || {
      totalViews: 0,
      totalUniqueViews: 0,
      totalClicks: 0,
      totalApplications: 0,
    };

    const analyticsList = await this.jobAnalyticsRepository.findByJobs(jobIds);
    const jobStats = jobs.map((job) => {
      const jobAnalytic = analyticsList.find(
        (a) => a.job.toString() === job._id.toString(),
      );
      return {
        jobId: job._id.toString(),
        title: job.title,
        views: jobAnalytic?.views || 0,
        clicks: jobAnalytic?.clicks || 0,
        applications: jobAnalytic?.applications || 0,
      };
    });

    const clickThroughRate = totals.totalViews > 0
      ? parseFloat(((totals.totalClicks / totals.totalViews) * 100).toFixed(2))
      : 0;
    const applicationRate = totals.totalClicks > 0
      ? parseFloat(((totals.totalApplications / totals.totalClicks) * 100).toFixed(2))
      : 0;

    return {
      totalJobs: jobs.length,
      totalViews: totals.totalViews,
      totalUniqueViews: totals.totalUniqueViews,
      totalClicks: totals.totalClicks,
      totalApplications: totals.totalApplications,
      clickThroughRate,
      applicationRate,
      jobStats,
    };
  }
}
