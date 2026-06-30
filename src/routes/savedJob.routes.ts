import { Router } from 'express';
import { savedJobController, authenticate, requireSubscription } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../types';

const router = Router();

// All saved job routes require employee auth
router.use(authenticate, roleGuard(UserRole.EMPLOYEE));

router.get('/', savedJobController.getSavedJobs);
router.post('/:jobId', requireSubscription('savedJobs'), savedJobController.saveJob);
router.delete('/:jobId', savedJobController.unsaveJob);
router.get('/:jobId/check', savedJobController.checkSaved);

export default router;
