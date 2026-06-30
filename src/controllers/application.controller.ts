import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../services/application.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApplicationStatus } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}
  async applyToJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await this.applicationService.applyToJob({
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

  async getApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await this.applicationService.getApplicationById(req.params.applicationId);
      ApiResponse.success(res, { application }, 'Application retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const status = req.query.status as string;

      const result = await this.applicationService.getMyApplications(
        req.userId!,
        { page, limit, sort, order },
        status
      );
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getJobApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const status = req.query.status as string;

      const result = await this.applicationService.getJobApplications(
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

  async updateApplicationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, note } = req.body;
      const application = await this.applicationService.updateApplicationStatus(
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

  async withdrawApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await this.applicationService.withdrawApplication(
        req.params.applicationId,
        req.userId!
      );
      ApiResponse.success(res, { application }, 'Application withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }

  async getApplicationResumeDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signedUrl = await this.applicationService.getApplicationResumeDownloadUrl(
        req.params.applicationId,
        req.userId!,
        req.userRole!,
      );
      ApiResponse.success(res, signedUrl, 'Signed resume URL generated');
    } catch (error) {
      next(error);
    }
  }
}

