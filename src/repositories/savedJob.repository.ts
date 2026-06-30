import SavedJob, { ISavedJob } from '../models/SavedJob';
import Job from '../models/Job';
import { PaginationOptions, PaginatedResult } from '../types';

export class SavedJobRepository {
  constructor(
    private readonly savedJobModel: typeof SavedJob = SavedJob,
    private readonly jobModel: typeof Job = Job,
  ) {}

  findJobById(jobId: string) {
    return this.jobModel.findById(jobId);
  }

  findSaved(employeeId: string, jobId: string) {
    return this.savedJobModel.findOne({ employee: employeeId, job: jobId });
  }

  create(employeeId: string, jobId: string) {
    return this.savedJobModel.create({ employee: employeeId, job: jobId });
  }

  deleteSaved(employeeId: string, jobId: string) {
    return this.savedJobModel.findOneAndDelete({ employee: employeeId, job: jobId });
  }

  async findByEmployee(
    employeeId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<ISavedJob>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query = { employee: employeeId };

    const [savedJobs, total] = await Promise.all([
      this.savedJobModel.find(query)
        .populate({
          path: 'job',
          select: 'title company location jobType workMode salaryMin salaryMax experienceLevel status createdAt',
          populate: { path: 'company', select: 'name logoUrl' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.savedJobModel.countDocuments(query),
    ]);

    return {
      data: savedJobs,
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

  countByEmployee(employeeId: string) {
    return this.savedJobModel.countDocuments({ employee: employeeId });
  }
}
