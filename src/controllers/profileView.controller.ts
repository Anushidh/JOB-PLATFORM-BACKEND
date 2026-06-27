import { Response, NextFunction } from 'express';
import profileViewService from '../services/profileView.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class ProfileViewController {
  /** Returns who viewed the authenticated user's profile (Premium+ only) */
  async getMyProfileViewers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

      const result = await profileViewService.getProfileViewers(req.userId!, { page, limit });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  /** Returns total view count for the past 30 days */
  async getMyViewCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await profileViewService.getViewCount(req.userId!);
      ApiResponse.success(res, { viewCount: count, period: '30 days' }, 'View count retrieved');
    } catch (error) {
      next(error);
    }
  }
}

export default new ProfileViewController();
