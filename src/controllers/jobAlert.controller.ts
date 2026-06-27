import { Response, NextFunction } from 'express';
import jobAlertService from '../services/jobAlert.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';

class JobAlertController {
  async createAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { name, filters, frequency } = req.body;

      const alert = await jobAlertService.createAlert(employeeId, { name, filters, frequency });
      ApiResponse.created(res, alert, 'Job alert created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const alerts = await jobAlertService.getMyAlerts(employeeId);

      ApiResponse.success(res, alerts, 'Job alerts retrieved');
    } catch (error) {
      next(error);
    }
  }

  async updateAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { alertId } = req.params;
      const { name, filters, frequency } = req.body;

      const alert = await jobAlertService.updateAlert(alertId, employeeId, { name, filters, frequency });
      ApiResponse.success(res, alert, 'Job alert updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { alertId } = req.params;

      await jobAlertService.deleteAlert(alertId, employeeId);
      ApiResponse.success(res, null, 'Job alert deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async toggleAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.userId!;
      const { alertId } = req.params;

      const alert = await jobAlertService.toggleAlert(alertId, employeeId);
      ApiResponse.success(res, alert, `Job alert ${alert.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      next(error);
    }
  }
}

export default new JobAlertController();
