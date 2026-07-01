import { Router } from 'express';
import { broadcastController } from '../container';

const router = Router();

router.post('/broadcast', broadcastController.sendBroadcast);

export default router;
