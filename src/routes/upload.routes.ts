import { Router } from 'express';
import { uploadController, authenticate } from '../container';
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
  uploadController.uploadAvatar
);

// Company logo upload (employer only)
router.post(
  '/company-logo',
  roleGuard(UserRole.EMPLOYER),
  uploadLogo,
  handleMulterError,
  uploadController.uploadCompanyLogo
);

// Resume upload (employee only)
router.post(
  '/resume',
  roleGuard(UserRole.EMPLOYEE),
  uploadResume,
  handleMulterError,
  uploadController.uploadResume
);

router.get(
  '/resume/download',
  roleGuard(UserRole.EMPLOYEE),
  uploadController.getResumeDownloadUrl
);

// Delete file (both roles)
router.delete(
  '/file',
  uploadController.deleteFile
);

export default router;
