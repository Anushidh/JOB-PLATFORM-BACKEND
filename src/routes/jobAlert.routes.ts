import { Router } from 'express';
import jobAlertController from '../controllers/jobAlert.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { UserRole } from '../types';
import { createAlertSchema, updateAlertSchema } from '../validators/jobAlert.validator';

const router = Router();

// All routes require employee authentication
router.use(authenticate, roleGuard(UserRole.EMPLOYEE) as any);

router.post('/', validate(createAlertSchema), jobAlertController.createAlert as any);
router.get('/', jobAlertController.getMyAlerts as any);
router.put('/:alertId', validate(updateAlertSchema), jobAlertController.updateAlert as any);
router.delete('/:alertId', jobAlertController.deleteAlert as any);
router.patch('/:alertId/toggle', jobAlertController.toggleAlert as any);

export default router;
