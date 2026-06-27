import SavedJob, { ISavedJob } from '../models/SavedJob';
import Job from '../models/Job';
import { ApiError } from '../utils/apiError';
import { PaginationOptions, PaginatedResult } from '../types';

class SavedJobService {
  /** Saves a job to the employee's saved list */
  async saveJob(employeeId: string, jobId: string): Promise<ISavedJob> {
    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    // Check if already saved
    const existing = await SavedJob.findOne({ employee: employeeId, job: jobId });
    if (existing) {
      throw ApiError.conflict('Job already saved');
    }

    const savedJob = await SavedJob.create({ employee: employeeId, job: jobId });
    return savedJob.populate({
      path: 'job',
      select: 'title company location jobType workMode salaryMin salaryMax',
      populate: { path: 'company', select: 'name logoUrl' },
    });
  }

  /** Removes a job from the employee's saved list */
  async unsaveJob(employeeId: string, jobId: string): Promise<void> {
    const result = await SavedJob.findOneAndDelete({ employee: employeeId, job: jobId });
    if (!result) {
      throw ApiError.notFound('Saved job not found');
    }
  }

  /** Returns paginated list of saved jobs for an employee with populated job details */
  async getSavedJobs(
    employeeId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<ISavedJob>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query = { employee: employeeId };

    const [savedJobs, total] = await Promise.all([
      SavedJob.find(query)
        .populate({
          path: 'job',
          select: 'title company location jobType workMode salaryMin salaryMax experienceLevel status createdAt',
          populate: { path: 'company', select: 'name logoUrl' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SavedJob.countDocuments(query),
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

  /** Checks whether a specific job is in the employee's saved list */
  async isJobSaved(employeeId: string, jobId: string): Promise<boolean> {
    const saved = await SavedJob.findOne({ employee: employeeId, job: jobId });
    return !!saved;
  }
}

export default new SavedJobService();
