import { Router } from 'express';
import { messageController, authenticate, requireSubscription } from '../container';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '../validators/message.validator';

const router = Router();

// All message routes require authentication + Premium subscription
router.use(authenticate, requireSubscription('messaging'));

router.post('/', validate(sendMessageSchema), messageController.sendMessage);
router.get('/conversations', messageController.getConversations);
router.get('/conversations/:conversationId', messageController.getMessages);
router.get('/unread-count', messageController.getUnreadCount);
router.delete('/conversations/:conversationId', messageController.deleteConversation);

export default router;
