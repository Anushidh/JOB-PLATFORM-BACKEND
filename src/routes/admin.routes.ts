import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { UserRole } from '../types';
import { rejectJobSchema } from '../validators/admin.validator';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, roleGuard(UserRole.ADMIN) as any);

// User management
router.get('/employees', adminController.getAllEmployees as any);
router.get('/employers', adminController.getAllEmployers as any);
router.patch('/users/:role/:userId/suspend', adminController.suspendUser as any);
router.patch('/users/:role/:userId/reactivate', adminController.reactivateUser as any);
router.delete('/users/:role/:userId', adminController.deleteUser as any);

// Job moderation
router.get('/jobs/pending', adminController.getPendingJobs as any);
router.patch('/jobs/:jobId/approve', adminController.approveJob as any);
router.patch('/jobs/:jobId/reject', validate(rejectJobSchema), adminController.rejectJob as any);

// Platform stats
router.get('/stats', adminController.getPlatformStats as any);

// Revenue dashboard
router.get('/revenue', adminController.getRevenueStats as any);
router.get('/revenue/payments', adminController.getPaymentHistory as any);

export default router;
