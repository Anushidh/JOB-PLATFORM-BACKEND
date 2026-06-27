import { Response, NextFunction } from 'express';
import adminService from '../services/admin.service';
import revenueService from '../services/revenue.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest, UserRole } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class AdminController {
  async getAllEmployees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const search = req.query.search as string;

      const result = await adminService.getAllEmployees({ page, limit, sort, order }, search);
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getAllEmployers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const search = req.query.search as string;

      const result = await adminService.getAllEmployers({ page, limit, sort, order }, search);
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      const user = await adminService.suspendUser(req.params.userId, role);
      ApiResponse.success(res, { user }, 'User suspended successfully');
    } catch (error) {
      next(error);
    }
  }

  async reactivateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      const user = await adminService.reactivateUser(req.params.userId, role);
      ApiResponse.success(res, { user }, 'User reactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role as UserRole;
      if (![UserRole.EMPLOYEE, UserRole.EMPLOYER].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role. Must be employee or employer.' });
        return;
      }
      await adminService.deleteUser(req.params.userId, role);
      ApiResponse.success(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPendingJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';

      const result = await adminService.getPendingJobs({ page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async approveJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await adminService.approveJob(req.params.jobId);
      ApiResponse.success(res, { job }, 'Job approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async rejectJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body;
      const job = await adminService.rejectJob(req.params.jobId, reason);
      ApiResponse.success(res, { job }, 'Job rejected');
    } catch (error) {
      next(error);
    }
  }

  async getPlatformStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getPlatformStats();
      ApiResponse.success(res, { stats }, 'Platform stats retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getRevenueStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await revenueService.getRevenueStats();
      ApiResponse.success(res, stats, 'Revenue stats retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getPaymentHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';

      const result = await revenueService.getPaymentHistory({ page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
