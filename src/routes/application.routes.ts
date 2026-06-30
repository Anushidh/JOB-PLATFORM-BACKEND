import { Router } from 'express';
import { applicationController, authenticate, requireSubscription } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { applicationLimiter } from '../middleware/rateLimiter';
import { UserRole } from '../types';
import { applySchema, updateApplicationStatusSchema } from '../validators/application.validator';

const router = Router();

// Employee routes
router.post(
  '/jobs/:jobId/apply',
  authenticate,
  roleGuard(UserRole.EMPLOYEE),
  requireSubscription('application'),
  applicationLimiter,
  validate(applySchema),
  applicationController.applyToJob
);

router.get(
  '/my-applications',
  authenticate,
  roleGuard(UserRole.EMPLOYEE),
  applicationController.getMyApplications
);

router.patch(
  '/:applicationId/withdraw',
  authenticate,
  roleGuard(UserRole.EMPLOYEE),
  applicationController.withdrawApplication
);

// Employer routes
router.get(
  '/jobs/:jobId/applications',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  applicationController.getJobApplications
);

router.patch(
  '/:applicationId/status',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(updateApplicationStatusSchema),
  applicationController.updateApplicationStatus
);

router.get(
  '/:applicationId/resume',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  requireSubscription('resumeAccess'),
  applicationController.getApplicationResumeDownloadUrl
);

// Shared
router.get(
  '/:applicationId',
  authenticate,
  applicationController.getApplication
);

export default router;
