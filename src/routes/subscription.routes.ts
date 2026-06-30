import { Router } from 'express';
import { subscriptionController, authenticate } from '../container';
import { validate } from '../middleware/validate';
import { cacheResponse } from '../middleware/cache';
import { createOrderSchema, verifyPaymentSchema } from '../validators/subscription.validator';

const router = Router();

// Public (cached for 10 minutes — plans rarely change)
router.get('/plans', cacheResponse(600), subscriptionController.getPlans);

// Authenticated
router.post('/create-order', authenticate, validate(createOrderSchema), subscriptionController.createOrder);
router.post('/verify-payment', authenticate, validate(verifyPaymentSchema), subscriptionController.verifyPayment);
router.get('/my-subscription', authenticate, subscriptionController.getMySubscription);
router.post('/cancel', authenticate, subscriptionController.cancelSubscription);
router.get('/invoice/:subscriptionId', authenticate, subscriptionController.downloadInvoice);

// Razorpay webhook (no auth)
router.post('/webhook', subscriptionController.webhook);

export default router;
