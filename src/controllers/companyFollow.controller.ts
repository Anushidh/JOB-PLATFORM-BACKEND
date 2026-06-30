import { Request, Response, NextFunction } from 'express';
import { CompanyFollowService } from '../services/companyFollow.service';
import { ApiResponse } from '../utils/apiResponse';

export class CompanyFollowController {
  constructor(private readonly companyFollowService: CompanyFollowService) {}
  async followCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.companyFollowService.followCompany(req.userId!, req.params.companyId);
      ApiResponse.success(res, null, 'Company followed');
    } catch (error) { next(error); }
  }

  async unfollowCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.companyFollowService.unfollowCompany(req.userId!, req.params.companyId);
      ApiResponse.success(res, null, 'Company unfollowed');
    } catch (error) { next(error); }
  }

  async getFollowedCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await this.companyFollowService.getFollowedCompanies(req.userId!);
      ApiResponse.success(res, { companies }, 'Followed companies retrieved');
    } catch (error) { next(error); }
  }

  async checkFollowing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isFollowing = await this.companyFollowService.isFollowing(req.userId!, req.params.companyId);
      ApiResponse.success(res, { isFollowing }, 'Check complete');
    } catch (error) { next(error); }
  }

  async getFollowerCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await this.companyFollowService.getFollowerCount(req.params.companyId);
      ApiResponse.success(res, { count }, 'Follower count retrieved');
    } catch (error) { next(error); }
  }
}

