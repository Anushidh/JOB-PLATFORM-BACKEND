import { Router } from 'express';
import { companyFollowController, authenticate } from '../container';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../types';

const router = Router();

// Public
router.get('/:companyId/followers/count', companyFollowController.getFollowerCount);

// Employee-only
router.post('/:companyId/follow', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.followCompany);
router.delete('/:companyId/follow', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.unfollowCompany);
router.get('/:companyId/check', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.checkFollowing);
router.get('/my/following', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.getFollowedCompanies);

export default router;
