import { Router } from 'express';
import { jobController, authenticate, requireSubscription } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { jobCreationLimiter } from '../middleware/rateLimiter';
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
  jobController.getMyJobs
);

// Recently viewed (authenticated, before /:jobId)
router.get('/recently-viewed', authenticate, jobController.getRecentlyViewed);

router.post(
  '/',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  requireSubscription('jobPost'),
  jobCreationLimiter,
  validate(createJobSchema),
  jobController.createJob
);

// Parameterized routes (cached for 5 minutes)
router.get('/:jobId', cacheResponse(300), jobController.getJob);

// Similar jobs (after /:jobId)
router.get('/:jobId/similar', cacheResponse(300), jobController.getSimilarJobs);

// Job quick stats (employer only)
router.get('/:jobId/stats', authenticate, roleGuard(UserRole.EMPLOYER), jobController.getJobQuickStats);

router.put(
  '/:jobId',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(updateJobSchema),
  jobController.updateJob
);

router.delete(
  '/:jobId',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  jobController.deleteJob
);

router.patch(
  '/:jobId/status',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(changeJobStatusSchema),
  jobController.changeJobStatus
);

export default router;
