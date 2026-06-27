import { Request, Response, NextFunction } from 'express';
import companyFollowService from '../services/companyFollow.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';

class CompanyFollowController {
  async followCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await companyFollowService.followCompany(req.userId!, req.params.companyId);
      ApiResponse.success(res, null, 'Company followed');
    } catch (error) { next(error); }
  }

  async unfollowCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await companyFollowService.unfollowCompany(req.userId!, req.params.companyId);
      ApiResponse.success(res, null, 'Company unfollowed');
    } catch (error) { next(error); }
  }

  async getFollowedCompanies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await companyFollowService.getFollowedCompanies(req.userId!);
      ApiResponse.success(res, { companies }, 'Followed companies retrieved');
    } catch (error) { next(error); }
  }

  async checkFollowing(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isFollowing = await companyFollowService.isFollowing(req.userId!, req.params.companyId);
      ApiResponse.success(res, { isFollowing }, 'Check complete');
    } catch (error) { next(error); }
  }

  async getFollowerCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await companyFollowService.getFollowerCount(req.params.companyId);
      ApiResponse.success(res, { count }, 'Follower count retrieved');
    } catch (error) { next(error); }
  }
}

export default new CompanyFollowController();
