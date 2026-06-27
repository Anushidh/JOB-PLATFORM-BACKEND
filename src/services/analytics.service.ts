import mongoose from 'mongoose';
import JobAnalytics, { IJobAnalytics } from '../models/JobAnalytics';
import Job from '../models/Job';
import { ApiError } from '../utils/apiError';

class AnalyticsService {
  private getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /** Returns or creates a JobAnalytics document for the given job */
  private async getOrCreateAnalytics(jobId: string): Promise<IJobAnalytics> {
    let analytics = await JobAnalytics.findOne({ job: jobId });
    if (!analytics) {
      analytics = await JobAnalytics.create({
        job: jobId,
        views: 0,
        uniqueViews: 0,
        clicks: 0,
        applications: 0,
        viewedBy: [],
        dailyStats: [],
      });
    }
    return analytics;
  }

  /** Increments today's daily stat entry for the specified metric */
  private async updateDailyStat(
    analytics: IJobAnalytics,
    field: 'views' | 'clicks' | 'applications'
  ): Promise<void> {
    const today = this.getTodayStart();
    const dailyStat = analytics.dailyStats.find(
      (stat) => stat.date.getTime() === today.getTime()
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

    await analytics.save();
  }

  /** Records a job view, tracking unique viewers by ID */
  async trackView(jobId: string, viewerId?: string): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const analytics = await this.getOrCreateAnalytics(jobId);

    // Increment total views
    analytics.views += 1;

    // Track unique views if viewerId is provided
    if (viewerId) {
      const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
      const alreadyViewed = analytics.viewedBy.some(
        (id) => id.toString() === viewerId
      );
      if (!alreadyViewed) {
        analytics.viewedBy.push(viewerObjectId);
        analytics.uniqueViews += 1;
      }
    }

    await analytics.save();
    await this.updateDailyStat(analytics, 'views');
  }

  /** Increments the click count for a job listing */
  async trackClick(jobId: string): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const analytics = await this.getOrCreateAnalytics(jobId);
    analytics.clicks += 1;
    await analytics.save();
    await this.updateDailyStat(analytics, 'clicks');
  }

  /** Increments the application count in job analytics */
  async trackApplication(jobId: string): Promise<void> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const analytics = await this.getOrCreateAnalytics(jobId);
    analytics.applications += 1;
    await analytics.save();
    await this.updateDailyStat(analytics, 'applications');
  }

  /** Returns analytics for a specific job after verifying the employer owns it */
  async getJobAnalytics(jobId: string, employerId: string): Promise<IJobAnalytics | null> {
    // Verify employer owns this job
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.employer.toString() !== employerId) {
      throw ApiError.forbidden('You do not have access to this job\'s analytics');
    }

    const analytics = await JobAnalytics.findOne({ job: jobId });
    if (!analytics) {
      // Return empty analytics object
      return await this.getOrCreateAnalytics(jobId);
    }

    return analytics;
  }

  /** Aggregates analytics across all employer's jobs including conversion rates and per-job breakdown */
  async getEmployerDashboardAnalytics(employerId: string): Promise<{
    totalJobs: number;
    totalViews: number;
    totalUniqueViews: number;
    totalClicks: number;
    totalApplications: number;
    clickThroughRate: number;
    applicationRate: number;
    jobStats: {
      jobId: string;
      title: string;
      views: number;
      clicks: number;
      applications: number;
    }[];
  }> {
    // Get all jobs for this employer
    const jobs = await Job.find({ employer: employerId }).select('_id title');

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

    // Aggregate analytics across all employer's jobs
    const aggregation = await JobAnalytics.aggregate([
      { $match: { job: { $in: jobIds } } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalUniqueViews: { $sum: '$uniqueViews' },
          totalClicks: { $sum: '$clicks' },
          totalApplications: { $sum: '$applications' },
        },
      },
    ]);

    const totals = aggregation[0] || {
      totalViews: 0,
      totalUniqueViews: 0,
      totalClicks: 0,
      totalApplications: 0,
    };

    // Get per-job stats
    const analyticsList = await JobAnalytics.find({ job: { $in: jobIds } });
    const jobStats = jobs.map((job) => {
      const jobAnalytic = analyticsList.find(
        (a) => a.job.toString() === job._id.toString()
      );
      return {
        jobId: job._id.toString(),
        title: job.title,
        views: jobAnalytic?.views || 0,
        clicks: jobAnalytic?.clicks || 0,
        applications: jobAnalytic?.applications || 0,
      };
    });

    // Calculate conversion rates
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

export default new AnalyticsService();
