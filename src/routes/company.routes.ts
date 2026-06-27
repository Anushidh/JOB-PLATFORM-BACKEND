import { Router } from 'express';
import companyController from '../controllers/company.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { cacheResponse } from '../middleware/cache';
import { UserRole } from '../types';
import { createCompanySchema, updateCompanySchema } from '../validators/company.validator';

const router = Router();

// Public routes (cached for 5 minutes)
router.get('/', cacheResponse(300), companyController.getCompanies);

// Employer routes (must come before /:companyId)
router.get(
  '/my/company',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  companyController.getMyCompany as any
);

router.post(
  '/',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(createCompanySchema),
  companyController.createCompany as any
);

// Parameterized routes
router.get('/:companyId', companyController.getCompany);

router.put(
  '/:companyId',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  validate(updateCompanySchema),
  companyController.updateCompany as any
);

router.delete(
  '/:companyId',
  authenticate,
  roleGuard(UserRole.EMPLOYER),
  companyController.deleteCompany as any
);

export default router;
