import { Router } from 'express';
import profileViewController from '../controllers/profileView.controller';
import { authenticate } from '../middleware/auth';
import { requireSubscription } from '../middleware/requireSubscription';

const router = Router();

// View count is available for everyone
router.get('/count', authenticate, profileViewController.getMyViewCount as any);

// Seeing WHO viewed requires Premium+
router.get('/viewers', authenticate, requireSubscription('profileViewers'), profileViewController.getMyProfileViewers as any);

export default router;
