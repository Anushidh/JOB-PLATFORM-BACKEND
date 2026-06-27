import { Router } from 'express';
import applicationController from '../controllers/application.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { applicationLimiter } from '../middleware/rateLimiter';
import { requireSubscription } from '../middleware/requireSubscription';
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
  applicationController.applyToJob as any
);

router.get(
  '/my-applications',
  authenticate,
  roleGuard(UserRole.EMPLOYEE),
  applicationController.getMyApplications as any
);

router.patch(
  '/:applicationId/withdraw',
  authenticate,
  roleGuard(UserRole.EMPLOYEE),
  applicationController.withdrawApplication as any
);

// Employer routes
router.get(
  '/jobs/:jobId/applications',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  applicationController.getJobApplications as any
);

router.patch(
  '/:applicationId/status',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(updateApplicationStatusSchema),
  applicationController.updateApplicationStatus as any
);

// Shared
router.get(
  '/:applicationId',
  authenticate,
  applicationController.getApplication as any
);

export default router;
