import { Router } from 'express';
import { userController, authenticate } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { sensitiveLimiter } from '../middleware/rateLimiter';
import { UserRole } from '../types';
import {
  updateEmployeeProfileSchema,
  updateEmployerProfileSchema,
  changePasswordSchema,
  updateResumeSchema,
} from '../validators/user.validator';

const router = Router();

// Protected routes
router.get('/profile', authenticate, userController.getProfile);
router.get('/profile-completion', authenticate, userController.getProfileCompletion);
router.put('/profile/employee', authenticate, roleGuard(UserRole.EMPLOYEE), validate(updateEmployeeProfileSchema), userController.updateProfile);
router.put('/profile/employer', authenticate, roleGuard(UserRole.EMPLOYER), validate(updateEmployerProfileSchema), userController.updateProfile);
router.patch('/change-password', authenticate, sensitiveLimiter, validate(changePasswordSchema), userController.changePassword);
router.patch('/resume', authenticate, roleGuard(UserRole.EMPLOYEE), validate(updateResumeSchema), userController.updateResume);

// Public routes
router.get('/employees/:userId/public', userController.getPublicEmployeeProfile);
router.get('/employers/:userId/public', userController.getPublicEmployerProfile);
router.get('/employees/search', userController.searchEmployees);

export default router;
