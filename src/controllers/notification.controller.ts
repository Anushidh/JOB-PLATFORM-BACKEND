import { Response, NextFunction } from 'express';
import notificationService from '../services/notification.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class NotificationController {
  async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const unreadOnly = req.query.unread === 'true';

      const result = await notificationService.getUserNotifications(
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

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await notificationService.markAsRead(
        req.params.notificationId,
        req.userId!
      );
      ApiResponse.success(res, { notification }, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.userId!, req.userRole!);
      ApiResponse.success(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.getUnreadCount(req.userId!, req.userRole!);
      ApiResponse.success(res, { count }, 'Unread count retrieved');
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.deleteNotification(
        req.params.notificationId,
        req.userId!
      );
      ApiResponse.success(res, null, 'Notification deleted');
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
