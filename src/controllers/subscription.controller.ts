import { Request, Response, NextFunction } from 'express';
import subscriptionService from '../services/subscription.service';
import invoiceService from '../services/invoice.service';
import Subscription, { SubscriptionStatus } from '../models/Subscription';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuthRequest } from '../types';

class SubscriptionController {
  async getPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = subscriptionService.getPlans();
      ApiResponse.success(res, plans, 'Plans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const userRole = req.userRole!;
      const { planType } = req.body;

      const result = await subscriptionService.createOrder(userId, userRole, planType);
      ApiResponse.success(res, result, 'Order created successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const subscription = await subscriptionService.verifyPayment(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      ApiResponse.success(res, subscription, 'Payment verified and subscription activated');
    } catch (error) {
      next(error);
    }
  }

  async getMySubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const subscription = await subscriptionService.getUserSubscription(userId);

      ApiResponse.success(res, subscription, subscription ? 'Subscription retrieved' : 'No active subscription');
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const subscription = await subscriptionService.cancelSubscription(userId);

      ApiResponse.success(res, subscription, 'Subscription cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      await subscriptionService.webhookHandler(req.body, signature);

      // Always return 200 to Razorpay
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      // Still return 200 to Razorpay to prevent retries, but log the error
      console.error('[Webhook] Error processing webhook:', error);
      res.status(200).json({ status: 'ok' });
    }
  }

  async downloadInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.params;

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw ApiError.notFound('Subscription not found');
      }

      // Verify the subscription belongs to this user (or user is admin)
      if (subscription.user.toString() !== req.userId) {
        throw ApiError.forbidden('You can only download your own invoices');
      }

      // Only generate invoices for paid subscriptions
      if (!subscription.razorpayPaymentId) {
        throw ApiError.badRequest('No payment found for this subscription');
      }

      const pdfBuffer = await invoiceService.generateInvoicePdf(subscription);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${subscriptionId}.pdf`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

export default new SubscriptionController();
