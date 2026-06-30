import { ApiError } from '../utils/apiError';
import { SavedJobRepository } from '../repositories/savedJob.repository';
import { ISavedJob } from '../models/SavedJob';
import { PaginationOptions, PaginatedResult } from '../types';

export class SavedJobService {
  constructor(private readonly savedJobRepository: SavedJobRepository) {}

  async saveJob(employeeId: string, jobId: string): Promise<ISavedJob> {
    const job = await this.savedJobRepository.findJobById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    const existing = await this.savedJobRepository.findSaved(employeeId, jobId);
    if (existing) {
      throw ApiError.conflict('Job already saved');
    }

    const savedJob = await this.savedJobRepository.create(employeeId, jobId);
    return savedJob.populate({
      path: 'job',
      select: 'title company location jobType workMode salaryMin salaryMax',
      populate: { path: 'company', select: 'name logoUrl' },
    });
  }

  async unsaveJob(employeeId: string, jobId: string): Promise<void> {
    const result = await this.savedJobRepository.deleteSaved(employeeId, jobId);
    if (!result) {
      throw ApiError.notFound('Saved job not found');
    }
  }

  async getSavedJobs(
    employeeId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<ISavedJob>> {
    return this.savedJobRepository.findByEmployee(employeeId, options);
  }

  async isJobSaved(employeeId: string, jobId: string): Promise<boolean> {
    const saved = await this.savedJobRepository.findSaved(employeeId, jobId);
    return !!saved;
  }
}
