import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { RevenueService } from '../services/revenue.service';
import { ApiResponse } from '../utils/apiResponse';
import { UserRole } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly revenueService: RevenueService,
  ) {}
  async getAllEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const search = req.query.search as string;

      const result = await this.adminService.getAllEmployees({ page, limit, sort, order }, search);
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getAllEmployers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const search = req.query.search as string;

      const result = await this.adminService.getAllEmployers({ page, limit, sort, order }, search);
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      const user = await this.adminService.getUserDetail(req.params.userId, role);
      ApiResponse.success(res, { user }, 'User detail retrieved');
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      const user = await this.adminService.suspendUser(req.params.userId, role);
      ApiResponse.success(res, { user }, 'User suspended successfully');
    } catch (error) {
      next(error);
    }
  }

  async reactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      const user = await this.adminService.reactivateUser(req.params.userId, role);
      ApiResponse.success(res, { user }, 'User reactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      await this.adminService.deleteUser(req.params.userId, role);
      ApiResponse.success(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPendingJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';

      const result = await this.adminService.getPendingJobs({ page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async approveJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await this.adminService.approveJob(req.params.jobId);
      ApiResponse.success(res, { job }, 'Job approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async rejectJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body;
      const job = await this.adminService.rejectJob(req.params.jobId, reason);
      ApiResponse.success(res, { job }, 'Job rejected');
    } catch (error) {
      next(error);
    }
  }

  async bulkApproveJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobIds } = req.body;
      const jobs = await this.adminService.bulkApproveJobs(jobIds);
      ApiResponse.success(res, { jobs }, 'Jobs approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkRejectJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobIds } = req.body;
      const jobs = await this.adminService.bulkRejectJobs(jobIds);
      ApiResponse.success(res, { jobs }, 'Jobs rejected successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPlatformStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.adminService.getPlatformStats();
      ApiResponse.success(res, { stats }, 'Platform stats retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getRevenueStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.revenueService.getRevenueStats();
      ApiResponse.success(res, stats, 'Revenue stats retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';

      const result = await this.revenueService.getPaymentHistory({ page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }
}

