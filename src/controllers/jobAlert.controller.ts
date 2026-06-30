import { Request, Response, NextFunction } from 'express';
import { JobAlertService } from '../services/jobAlert.service';
import { ApiResponse } from '../utils/apiResponse';

export class JobAlertController {
  constructor(private readonly jobAlertService: JobAlertService) {}
  async createAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { name, filters, frequency } = req.body;

      const alert = await this.jobAlertService.createAlert(employeeId, { name, filters, frequency });
      ApiResponse.created(res, alert, 'Job alert created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const alerts = await this.jobAlertService.getMyAlerts(employeeId);

      ApiResponse.success(res, alerts, 'Job alerts retrieved');
    } catch (error) {
      next(error);
    }
  }

  async updateAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { alertId } = req.params;
      const { name, filters, frequency } = req.body;

      const alert = await this.jobAlertService.updateAlert(alertId, employeeId, { name, filters, frequency });
      ApiResponse.success(res, alert, 'Job alert updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { alertId } = req.params;

      await this.jobAlertService.deleteAlert(alertId, employeeId);
      ApiResponse.success(res, null, 'Job alert deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async toggleAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { alertId } = req.params;

      const alert = await this.jobAlertService.toggleAlert(alertId, employeeId);
      ApiResponse.success(res, alert, `Job alert ${alert.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      next(error);
    }
  }
}

