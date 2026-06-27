import { Request, Response, NextFunction } from 'express';
import userService from '../services/user.service';
import profileViewService from '../services/profileView.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest, UserRole } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class UserController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getProfile(req.userId!, req.userRole!);
      ApiResponse.success(res, { user, role: req.userRole }, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let user;
      if (req.userRole === UserRole.EMPLOYEE) {
        user = await userService.updateEmployeeProfile(req.userId!, req.body);
      } else {
        user = await userService.updateEmployerProfile(req.userId!, req.body);
      }
      ApiResponse.success(res, { user, role: req.userRole }, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await userService.changePassword(req.userId!, req.userRole!, currentPassword, newPassword);
      ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resumePath } = req.body;
      const user = await userService.updateResume(req.userId!, resumePath);
      ApiResponse.success(res, { user }, 'Resume updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicEmployeeProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getPublicEmployeeProfile(req.params.userId);

      // Record profile view if requester is authenticated
      const authReq = req as AuthRequest;
      if (authReq.userId && authReq.userRole) {
        profileViewService.recordView(
          req.params.userId, UserRole.EMPLOYEE,
          authReq.userId, authReq.userRole
        ).catch(() => {}); // fire and forget
      }

      ApiResponse.success(res, { user }, 'Public profile retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getPublicEmployerProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getPublicEmployerProfile(req.params.userId);

      // Record profile view if requester is authenticated
      const authReq = req as AuthRequest;
      if (authReq.userId && authReq.userRole) {
        profileViewService.recordView(
          req.params.userId, UserRole.EMPLOYER,
          authReq.userId, authReq.userRole
        ).catch(() => {}); // fire and forget
      }

      ApiResponse.success(res, { user }, 'Public profile retrieved');
    } catch (error) {
      next(error);
    }
  }

  async searchEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const search = req.query.search as string;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';

      const result = await userService.searchEmployees(search, { page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getProfileCompletion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getProfile(req.userId!, req.userRole!);
      const completion = userService.calculateProfileCompletion(user, req.userRole!);
      ApiResponse.success(res, completion, 'Profile completion calculated');
    } catch (error) { next(error); }
  }
}

export default new UserController();
