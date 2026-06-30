import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { ProfileViewService } from '../services/profileView.service';
import { ApiResponse } from '../utils/apiResponse';
import { UserRole } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly profileViewService: ProfileViewService,
  ) {}
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.getProfile(req.userId!, req.userRole!);
      ApiResponse.success(res, { user, role: req.userRole }, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let user;
      if (req.userRole === UserRole.EMPLOYEE) {
        user = await this.userService.updateEmployeeProfile(req.userId!, req.body);
      } else {
        user = await this.userService.updateEmployerProfile(req.userId!, req.body);
      }
      ApiResponse.success(res, { user, role: req.userRole }, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.userService.changePassword(req.userId!, req.userRole!, currentPassword, newPassword);
      ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resumePath } = req.body;
      const user = await this.userService.updateResume(req.userId!, resumePath);
      ApiResponse.success(res, { user }, 'Resume updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicEmployeeProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.getPublicEmployeeProfile(req.params.userId);

      // Record profile view if requester is authenticated
      const authReq = req as Request;
      if (authReq.userId && authReq.userRole) {
        this.profileViewService.recordView(
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
      const user = await this.userService.getPublicEmployerProfile(req.params.userId);

      // Record profile view if requester is authenticated
      const authReq = req as Request;
      if (authReq.userId && authReq.userRole) {
        this.profileViewService.recordView(
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

      const result = await this.userService.searchEmployees(search, { page, limit, sort, order });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getProfileCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.getProfile(req.userId!, req.userRole!);
      const completion = this.userService.calculateProfileCompletion(user, req.userRole!);
      ApiResponse.success(res, completion, 'Profile completion calculated');
    } catch (error) { next(error); }
  }
}

