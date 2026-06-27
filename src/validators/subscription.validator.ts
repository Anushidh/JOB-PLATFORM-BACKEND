import { z } from 'zod';
import { PlanType } from '../models/Subscription';

export const createOrderSchema = z.object({
  body: z.object({
    planType: z.enum([PlanType.BASIC, PlanType.PREMIUM, PlanType.ENTERPRISE], {
      errorMap: () => ({ message: 'Plan type must be basic, premium, or enterprise' }),
    }),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().min(1, 'Order ID is required'),
    razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
    razorpaySignature: z.string().min(1, 'Signature is required'),
  }),
});
