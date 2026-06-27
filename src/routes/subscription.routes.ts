import { Router } from 'express';
import subscriptionController from '../controllers/subscription.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { cacheResponse } from '../middleware/cache';
import { createOrderSchema, verifyPaymentSchema } from '../validators/subscription.validator';

const router = Router();

// Public (cached for 10 minutes — plans rarely change)
router.get('/plans', cacheResponse(600), subscriptionController.getPlans);

// Authenticated
router.post('/create-order', authenticate, validate(createOrderSchema), subscriptionController.createOrder as any);
router.post('/verify-payment', authenticate, validate(verifyPaymentSchema), subscriptionController.verifyPayment as any);
router.get('/my-subscription', authenticate, subscriptionController.getMySubscription as any);
router.post('/cancel', authenticate, subscriptionController.cancelSubscription as any);
router.get('/invoice/:subscriptionId', authenticate, subscriptionController.downloadInvoice as any);

// Razorpay webhook (no auth)
router.post('/webhook', subscriptionController.webhook);

export default router;
