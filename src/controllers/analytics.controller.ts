import { Request, Response, NextFunction } from 'express';
import analyticsService from '../services/analytics.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';

class AnalyticsController {
  async trackView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      // Optionally get viewerId from authenticated user
      const viewerId = (req as AuthRequest).userId || undefined;
      await analyticsService.trackView(jobId, viewerId);

      ApiResponse.success(res, null, 'View tracked');
    } catch (error) {
      next(error);
    }
  }

  async trackClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      await analyticsService.trackClick(jobId);

      ApiResponse.success(res, null, 'Click tracked');
    } catch (error) {
      next(error);
    }
  }

  async getJobAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.userId!;
      const analytics = await analyticsService.getJobAnalytics(jobId, employerId);

      ApiResponse.success(res, analytics, 'Job analytics retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getDashboardAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.userId!;
      const analytics = await analyticsService.getEmployerDashboardAnalytics(employerId);

      ApiResponse.success(res, analytics, 'Dashboard analytics retrieved');
    } catch (error) {
      next(error);
    }
  }
}

export default new AnalyticsController();
