import { Router } from 'express';
import { jobAlertController, authenticate } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { UserRole } from '../types';
import { createAlertSchema, updateAlertSchema } from '../validators/jobAlert.validator';

const router = Router();

// All routes require employee authentication
router.use(authenticate, roleGuard(UserRole.EMPLOYEE));

router.post('/', validate(createAlertSchema), jobAlertController.createAlert);
router.get('/', jobAlertController.getMyAlerts);
router.put('/:alertId', validate(updateAlertSchema), jobAlertController.updateAlert);
router.delete('/:alertId', jobAlertController.deleteAlert);
router.patch('/:alertId/toggle', jobAlertController.toggleAlert);

export default router;
