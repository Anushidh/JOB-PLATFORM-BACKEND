import { Request, Response, NextFunction } from 'express';
import { SavedJobService } from '../services/savedJob.service';
import { ApiResponse } from '../utils/apiResponse';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class SavedJobController {
  constructor(private readonly savedJobService: SavedJobService) {}
  async saveJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const savedJob = await this.savedJobService.saveJob(req.userId!, req.params.jobId);
      ApiResponse.created(res, { savedJob }, 'Job saved successfully');
    } catch (error) {
      next(error);
    }
  }

  async unsaveJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.savedJobService.unsaveJob(req.userId!, req.params.jobId);
      ApiResponse.success(res, null, 'Job removed from saved');
    } catch (error) {
      next(error);
    }
  }

  async getSavedJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

      const result = await this.savedJobService.getSavedJobs(req.userId!, { page, limit });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async checkSaved(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isSaved = await this.savedJobService.isJobSaved(req.userId!, req.params.jobId);
      ApiResponse.success(res, { isSaved }, 'Check complete');
    } catch (error) {
      next(error);
    }
  }
}

