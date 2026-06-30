import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/apiResponse';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}
  async trackView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      // Optionally get viewerId from authenticated user
      const viewerId = req.userId || undefined;
      await this.analyticsService.trackView(jobId, viewerId);

      ApiResponse.success(res, null, 'View tracked');
    } catch (error) {
      next(error);
    }
  }

  async trackClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      await this.analyticsService.trackClick(jobId);

      ApiResponse.success(res, null, 'Click tracked');
    } catch (error) {
      next(error);
    }
  }

  async getJobAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.userId!;
      const analytics = await this.analyticsService.getJobAnalytics(jobId, employerId);

      ApiResponse.success(res, analytics, 'Job analytics retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getDashboardAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.userId!;
      const analytics = await this.analyticsService.getEmployerDashboardAnalytics(employerId);

      ApiResponse.success(res, analytics, 'Dashboard analytics retrieved');
    } catch (error) {
      next(error);
    }
  }
}

