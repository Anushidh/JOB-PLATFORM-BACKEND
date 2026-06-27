import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/', notificationController.getNotifications as any);
router.get('/unread-count', notificationController.getUnreadCount as any);
router.patch('/read-all', notificationController.markAllAsRead as any);
router.patch('/:notificationId/read', notificationController.markAsRead as any);
router.delete('/:notificationId', notificationController.deleteNotification as any);

export default router;
