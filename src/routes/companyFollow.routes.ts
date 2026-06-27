import { Router } from 'express';
import companyFollowController from '../controllers/companyFollow.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../types';

const router = Router();

// Public
router.get('/:companyId/followers/count', companyFollowController.getFollowerCount);

// Employee-only
router.post('/:companyId/follow', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.followCompany as any);
router.delete('/:companyId/follow', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.unfollowCompany as any);
router.get('/:companyId/check', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.checkFollowing as any);
router.get('/my/following', authenticate, roleGuard(UserRole.EMPLOYEE), companyFollowController.getFollowedCompanies as any);

export default router;
