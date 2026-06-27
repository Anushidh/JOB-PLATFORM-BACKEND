import { Request, Response, NextFunction } from 'express';
import jobService from '../services/job.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest, IEmployer, JobStatus, UserRole } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class JobController {
  async createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = req.user as IEmployer;
      const jobData = {
        ...req.body,
        employer: req.userId,
        company: employer.company,
      };

      const job = await jobService.createJob(jobData);
      ApiResponse.created(res, { job }, 'Job created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.getJobById(req.params.jobId);

      // Record recent view if user is authenticated
      const authReq = req as AuthRequest;
      if (authReq.userId) {
        jobService.recordRecentView(authReq.userId, req.params.jobId).catch(() => {});
      }

      ApiResponse.success(res, { job }, 'Job retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.updateJob(
        req.params.jobId,
        req.userId!,
        req.body
      );
      ApiResponse.success(res, { job }, 'Job updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await jobService.deleteJob(req.params.jobId, req.userId!);
      ApiResponse.success(res, null, 'Job deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async changeJobStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const job = await jobService.changeJobStatus(
        req.params.jobId,
        req.userId!,
        status as JobStatus
      );
      ApiResponse.success(res, { job }, 'Job status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';

      const filters = {
        search: req.query.search as string,
        location: req.query.location as string,
        jobType: req.query.jobType as string,
        workMode: req.query.workMode as string,
        experienceLevel: req.query.experienceLevel as string,
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
        salaryMin: req.query.salaryMin ? parseInt(req.query.salaryMin as string) : undefined,
        salaryMax: req.query.salaryMax ? parseInt(req.query.salaryMax as string) : undefined,
      };

      const result = await jobService.getJobs(filters, { page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getMyJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const status = req.query.status as string;

      const result = await jobService.getEmployerJobs(
        req.userId!,
        { page, limit, sort, order },
        status
      );
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getSimilarJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobs = await jobService.getSimilarJobs(req.params.jobId);
      ApiResponse.success(res, { jobs }, 'Similar jobs retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getRecentlyViewed(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobs = await jobService.getRecentlyViewed(req.userId!);
      ApiResponse.success(res, { jobs }, 'Recently viewed jobs retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getJobQuickStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await jobService.getJobQuickStats(req.params.jobId, req.userId!);
      ApiResponse.success(res, stats, 'Job quick stats retrieved');
    } catch (error) {
      next(error);
    }
  }
}

export default new JobController();
