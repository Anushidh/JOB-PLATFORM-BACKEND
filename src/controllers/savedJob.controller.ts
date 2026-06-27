import { Response, NextFunction } from 'express';
import savedJobService from '../services/savedJob.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class SavedJobController {
  async saveJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const savedJob = await savedJobService.saveJob(req.userId!, req.params.jobId);
      ApiResponse.created(res, { savedJob }, 'Job saved successfully');
    } catch (error) {
      next(error);
    }
  }

  async unsaveJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await savedJobService.unsaveJob(req.userId!, req.params.jobId);
      ApiResponse.success(res, null, 'Job removed from saved');
    } catch (error) {
      next(error);
    }
  }

  async getSavedJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

      const result = await savedJobService.getSavedJobs(req.userId!, { page, limit });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async checkSaved(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isSaved = await savedJobService.isJobSaved(req.userId!, req.params.jobId);
      ApiResponse.success(res, { isSaved }, 'Check complete');
    } catch (error) {
      next(error);
    }
  }
}

export default new SavedJobController();
