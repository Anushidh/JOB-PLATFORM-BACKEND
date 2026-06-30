import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../utils/apiResponse';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const unreadOnly = req.query.unread === 'true';

      const result = await this.notificationService.getUserNotifications(
        req.userId!,
        req.userRole!,
        { page, limit },
        unreadOnly
      );
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await this.notificationService.markAsRead(
        req.params.notificationId,
        req.userId!
      );
      ApiResponse.success(res, { notification }, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.notificationService.markAllAsRead(req.userId!, req.userRole!);
      ApiResponse.success(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await this.notificationService.getUnreadCount(req.userId!, req.userRole!);
      ApiResponse.success(res, { count }, 'Unread count retrieved');
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.notificationService.deleteNotification(
        req.params.notificationId,
        req.userId!
      );
      ApiResponse.success(res, null, 'Notification deleted');
    } catch (error) {
      next(error);
    }
  }
}

