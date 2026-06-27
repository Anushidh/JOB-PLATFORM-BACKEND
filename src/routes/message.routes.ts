import { Router } from 'express';
import messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireSubscription } from '../middleware/requireSubscription';
import { sendMessageSchema } from '../validators/message.validator';

const router = Router();

// All message routes require authentication + Premium subscription
router.use(authenticate, requireSubscription('messaging'));

router.post('/', validate(sendMessageSchema), messageController.sendMessage as any);
router.get('/conversations', messageController.getConversations as any);
router.get('/conversations/:conversationId', messageController.getMessages as any);
router.get('/unread-count', messageController.getUnreadCount as any);
router.delete('/conversations/:conversationId', messageController.deleteConversation as any);

export default router;
