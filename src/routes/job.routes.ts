import { Router } from 'express';
import jobController from '../controllers/job.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { jobCreationLimiter } from '../middleware/rateLimiter';
import { requireSubscription } from '../middleware/requireSubscription';
import { cacheResponse } from '../middleware/cache';
import { UserRole } from '../types';
import { createJobSchema, updateJobSchema, changeJobStatusSchema } from '../validators/job.validator';

const router = Router();

// Public routes (cached for 5 minutes)
router.get('/', cacheResponse(300), jobController.getJobs);

// Employer routes (must come before /:jobId)
router.get(
  '/employer/my-jobs',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  jobController.getMyJobs as any
);

// Recently viewed (authenticated, before /:jobId)
router.get('/recently-viewed', authenticate, jobController.getRecentlyViewed as any);

router.post(
  '/',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  requireSubscription('jobPost'),
  jobCreationLimiter,
  validate(createJobSchema),
  jobController.createJob as any
);

// Parameterized routes (cached for 5 minutes)
router.get('/:jobId', cacheResponse(300), jobController.getJob);

// Similar jobs (after /:jobId)
router.get('/:jobId/similar', cacheResponse(300), jobController.getSimilarJobs);

// Job quick stats (employer only)
router.get('/:jobId/stats', authenticate, roleGuard(UserRole.EMPLOYER), jobController.getJobQuickStats as any);

router.put(
  '/:jobId',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(updateJobSchema),
  jobController.updateJob as any
);

router.delete(
  '/:jobId',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  jobController.deleteJob as any
);

router.patch(
  '/:jobId/status',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(changeJobStatusSchema),
  jobController.changeJobStatus as any
);

export default router;
