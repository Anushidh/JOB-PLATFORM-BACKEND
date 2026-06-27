import { Router } from 'express';
import analyticsController from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { requireSubscription } from '../middleware/requireSubscription';
import { UserRole } from '../types';

const router = Router();

// Public routes - track views and clicks
router.post('/jobs/:jobId/view', analyticsController.trackView);
router.post('/jobs/:jobId/click', analyticsController.trackClick);

// Employer-only routes - view analytics (requires subscription)
router.get('/jobs/:jobId', authenticate, roleGuard(UserRole.EMPLOYER), requireSubscription('analyticsAccess'), analyticsController.getJobAnalytics as any);
router.get('/dashboard', authenticate, roleGuard(UserRole.EMPLOYER), requireSubscription('analyticsAccess'), analyticsController.getDashboardAnalytics as any);

export default router;
