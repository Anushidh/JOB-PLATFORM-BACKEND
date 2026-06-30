import { Router } from 'express';
import { analyticsController, authenticate, requireSubscription } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../types';

const router = Router();

// Public routes - track views and clicks
router.post('/jobs/:jobId/view', analyticsController.trackView);
router.post('/jobs/:jobId/click', analyticsController.trackClick);

// Employer-only routes - view analytics (requires subscription)
router.get('/jobs/:jobId', authenticate, roleGuard(UserRole.EMPLOYER), requireSubscription('analyticsAccess'), analyticsController.getJobAnalytics);
router.get('/dashboard', authenticate, roleGuard(UserRole.EMPLOYER), requireSubscription('analyticsAccess'), analyticsController.getDashboardAnalytics);

export default router;
