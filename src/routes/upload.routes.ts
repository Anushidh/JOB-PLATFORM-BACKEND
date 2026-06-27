import { Router } from 'express';
import uploadController from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { uploadAvatar, uploadLogo, uploadResume, handleMulterError } from '../middleware/upload';
import { UserRole } from '../types';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

// Avatar upload (both roles)
router.post(
  '/avatar',
  uploadAvatar,
  handleMulterError,
  uploadController.uploadAvatar as any
);

// Company logo upload (employer only)
router.post(
  '/company-logo',
  roleGuard(UserRole.EMPLOYER),
  uploadLogo,
  handleMulterError,
  uploadController.uploadCompanyLogo as any
);

// Resume upload (employee only)
router.post(
  '/resume',
  roleGuard(UserRole.EMPLOYEE),
  uploadResume,
  handleMulterError,
  uploadController.uploadResume as any
);

// Delete file (both roles)
router.delete(
  '/file',
  uploadController.deleteFile as any
);

export default router;
