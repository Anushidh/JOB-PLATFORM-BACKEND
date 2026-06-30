import { Router } from 'express';
import { profileViewController, authenticate, requireSubscription } from '../container';

const router = Router();

// View count is available for everyone
router.get('/count', authenticate, profileViewController.getMyViewCount);

// Seeing WHO viewed requires Premium+
router.get('/viewers', authenticate, requireSubscription('profileViewers'), profileViewController.getMyProfileViewers);

export default router;
