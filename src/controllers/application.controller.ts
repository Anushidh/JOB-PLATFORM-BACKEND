import { Response, NextFunction } from 'express';
import applicationService from '../services/application.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest, ApplicationStatus } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class ApplicationController {
  async applyToJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await applicationService.applyToJob({
        jobId: req.params.jobId,
        applicantId: req.userId!,
        coverLetter: req.body.coverLetter,
        resumePath: req.body.resumePath,
      });
      ApiResponse.created(res, { application }, 'Application submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await applicationService.getApplicationById(req.params.applicationId);
      ApiResponse.success(res, { application }, 'Application retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const status = req.query.status as string;

      const result = await applicationService.getMyApplications(
        req.userId!,
        { page, limit, sort, order },
        status
      );
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getJobApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const status = req.query.status as string;

      const result = await applicationService.getJobApplications(
        req.params.jobId,
        req.userId!,
        { page, limit, sort, order },
        status
      );
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async updateApplicationStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, note } = req.body;
      const application = await applicationService.updateApplicationStatus(
        req.params.applicationId,
        req.userId!,
        status as ApplicationStatus,
        note
      );
      ApiResponse.success(res, { application }, 'Application status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async withdrawApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await applicationService.withdrawApplication(
        req.params.applicationId,
        req.userId!
      );
      ApiResponse.success(res, { application }, 'Application withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new ApplicationController();
