import mongoose, { type ClientSession } from 'mongoose';
import JobAnalytics, { IJobAnalytics } from '../models/JobAnalytics';
import Job from '../models/Job';

export class JobAnalyticsRepository {
  constructor(
    private readonly jobAnalyticsModel: typeof JobAnalytics = JobAnalytics,
    private readonly jobModel: typeof Job = Job,
  ) {}

  findByJob(jobId: string, session?: ClientSession) {
    const query = this.jobAnalyticsModel.findOne({ job: jobId });
    return session ? query.session(session) : query;
  }

  create(jobId: string, session?: ClientSession) {
    if (session) {
      return this.jobAnalyticsModel.create([{
        job: jobId,
        views: 0,
        uniqueViews: 0,
        clicks: 0,
        applications: 0,
        viewedBy: [],
        dailyStats: [],
      }], { session }).then((docs) => docs[0]);
    }

    return this.jobAnalyticsModel.create({
      job: jobId,
      views: 0,
      uniqueViews: 0,
      clicks: 0,
      applications: 0,
      viewedBy: [],
      dailyStats: [],
    });
  }

  findJobById(jobId: string) {
    return this.jobModel.findById(jobId);
  }

  findByJobs(jobIds: mongoose.Types.ObjectId[]) {
    return this.jobAnalyticsModel.find({ job: { $in: jobIds } });
  }

  aggregateByJobs(jobIds: mongoose.Types.ObjectId[]) {
    return this.jobAnalyticsModel.aggregate([
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
  }

  async getOrCreate(jobId: string, session?: ClientSession): Promise<IJobAnalytics> {
    let analytics = await this.findByJob(jobId, session);
    if (!analytics) {
      analytics = await this.create(jobId, session);
    }
    return analytics;
  }
}
