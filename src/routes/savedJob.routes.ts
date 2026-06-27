import { Router } from 'express';
import savedJobController from '../controllers/savedJob.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { requireSubscription } from '../middleware/requireSubscription';
import { UserRole } from '../types';

const router = Router();

// All saved job routes require employee auth
router.use(authenticate, roleGuard(UserRole.EMPLOYEE));

router.get('/', savedJobController.getSavedJobs as any);
router.post('/:jobId', requireSubscription('savedJobs'), savedJobController.saveJob as any);
router.delete('/:jobId', savedJobController.unsaveJob as any);
router.get('/:jobId/check', savedJobController.checkSaved as any);

export default router;
