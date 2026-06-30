import { Router } from 'express';
import { adminController, authenticate } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { UserRole } from '../types';
import { rejectJobSchema } from '../validators/admin.validator';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, roleGuard(UserRole.ADMIN));

// User management
router.get('/employees', adminController.getAllEmployees);
router.get('/employers', adminController.getAllEmployers);
router.patch('/users/:role/:userId/suspend', adminController.suspendUser);
router.patch('/users/:role/:userId/reactivate', adminController.reactivateUser);
router.delete('/users/:role/:userId', adminController.deleteUser);

// Job moderation
router.get('/jobs/pending', adminController.getPendingJobs);
router.patch('/jobs/:jobId/approve', adminController.approveJob);
router.patch('/jobs/:jobId/reject', validate(rejectJobSchema), adminController.rejectJob);

// Platform stats
router.get('/stats', adminController.getPlatformStats);

// Revenue dashboard
router.get('/revenue', adminController.getRevenueStats);
router.get('/revenue/payments', adminController.getPaymentHistory);

export default router;
