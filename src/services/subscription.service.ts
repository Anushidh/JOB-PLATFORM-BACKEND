import Razorpay from 'razorpay';
import crypto from 'crypto';
import Subscription, { ISubscription, PlanType, SubscriptionStatus } from '../models/Subscription';
import { ApiError } from '../utils/apiError';
import env from '../config/env';
import invoiceService from './invoice.service';
import emailService from './email.service';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { UserRole } from '../types';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

interface PlanDetails {
  type: PlanType;
  name: string;
  amount: number;
  currency: string;
  duration: number; // in days
  gst: {
    rate: number;
    baseAmount: number;
    cgst: number;
    sgst: number;
  };
  features: {
    maxJobPosts?: number;
    maxApplications?: number;
    premiumPlacement: boolean;
    resumeAccess: boolean;
    analyticsAccess: boolean;
  };
}

const GST_RATE = 18;

function calculateGst(totalInPaise: number) {
  const baseAmount = Math.round(totalInPaise / (1 + GST_RATE / 100));
  const totalGst = totalInPaise - baseAmount;
  const cgst = Math.round(totalGst / 2);
  const sgst = totalGst - cgst;
  return { rate: GST_RATE, baseAmount, cgst, sgst };
}

const PLANS: PlanDetails[] = [
  {
    type: PlanType.FREE,
    name: 'Free',
    amount: 0,
    currency: 'INR',
    duration: 365,
    gst: { rate: 0, baseAmount: 0, cgst: 0, sgst: 0 },
    features: {
      maxJobPosts: 3,
      maxApplications: 10,
      premiumPlacement: false,
      resumeAccess: false,
      analyticsAccess: false,
    },
  },
  {
    type: PlanType.BASIC,
    name: 'Basic',
    amount: 99900, // ₹999 inclusive of GST
    currency: 'INR',
    duration: 30,
    gst: calculateGst(99900),
    features: {
      maxJobPosts: 10,
      maxApplications: 50,
      premiumPlacement: false,
      resumeAccess: true,
      analyticsAccess: true,
    },
  },
  {
    type: PlanType.PREMIUM,
    name: 'Premium',
    amount: 249900, // ₹2499 inclusive of GST
    currency: 'INR',
    duration: 30,
    gst: calculateGst(249900),
    features: {
      maxJobPosts: 50,
      maxApplications: 200,
      premiumPlacement: true,
      resumeAccess: true,
      analyticsAccess: true,
    },
  },
  {
    type: PlanType.ENTERPRISE,
    name: 'Enterprise',
    amount: 999900, // ₹9999 inclusive of GST
    currency: 'INR',
    duration: 30,
    gst: calculateGst(999900),
    features: {
      maxJobPosts: undefined, // unlimited
      maxApplications: undefined, // unlimited
      premiumPlacement: true,
      resumeAccess: true,
      analyticsAccess: true,
    },
  },
];

class SubscriptionService {
  /** Returns the list of available subscription plans with features and pricing */
  getPlans(): PlanDetails[] {
    return PLANS;
  }

  /** Creates a Razorpay payment order and a pending subscription record */
  async createOrder(
    userId: string,
    userRole: string,
    planType: PlanType
  ): Promise<{ order: any; subscription: ISubscription }> {
    const plan = PLANS.find((p) => p.type === planType);
    if (!plan) {
      throw ApiError.badRequest('Invalid plan type');
    }

    if (plan.type === PlanType.FREE) {
      throw ApiError.badRequest('Free plan does not require payment');
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
    });

    if (existingSubscription) {
      throw ApiError.conflict('You already have an active subscription. Cancel it first to switch plans.');
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `sub_${userId}_${Date.now()}`,
      notes: {
        userId,
        userRole,
        planType,
      },
    });

    // Create pending subscription record
    const subscription = await Subscription.create({
      user: userId,
      userRole,
      plan: planType,
      status: SubscriptionStatus.PENDING,
      razorpayOrderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      features: plan.features,
    });

    return { order, subscription };
  }

  /** Verifies Razorpay payment signature, activates the subscription, and sends an invoice email */
  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<ISubscription> {
    // Verify signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw ApiError.badRequest('Invalid payment signature');
    }

    // Find pending subscription
    const subscription = await Subscription.findOne({
      razorpayOrderId,
      status: SubscriptionStatus.PENDING,
    });

    if (!subscription) {
      throw ApiError.notFound('Subscription not found or already processed');
    }

    // Get plan details for duration
    const plan = PLANS.find((p) => p.type === subscription.plan);
    const duration = plan ? plan.duration : 30;

    // Activate subscription
    const now = new Date();
    const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.razorpayPaymentId = razorpayPaymentId;
    subscription.startDate = now;
    subscription.endDate = endDate;
    await subscription.save();

    // Send invoice email asynchronously
    this.sendInvoiceEmail(subscription).catch((err) =>
      console.error('[Invoice] Failed to send invoice email:', err)
    );

    return subscription;
  }

  /** Generates a PDF invoice and emails it to the subscriber */
  private async sendInvoiceEmail(subscription: ISubscription): Promise<void> {
    let email = '';
    let name = '';

    if (subscription.userRole === UserRole.EMPLOYEE) {
      const user = await Employee.findById(subscription.user);
      if (user) { email = user.email; name = user.firstName; }
    } else if (subscription.userRole === UserRole.EMPLOYER) {
      const user = await Employer.findById(subscription.user);
      if (user) { email = user.email; name = user.firstName; }
    }

    if (!email) return;

    const pdfBuffer = await invoiceService.generateInvoicePdf(subscription);
    const amount = (subscription.amount / 100).toLocaleString('en-IN');

    await emailService.sendWithAttachment(
      email,
      'Payment Confirmation & Invoice - Job Platform',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${name},</h2>
          <p>Thank you for your payment! Your <strong>${subscription.plan}</strong> plan is now active.</p>
          <p><strong>Amount:</strong> ₹${amount}</p>
          <p><strong>Valid until:</strong> ${subscription.endDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p>Your invoice is attached to this email.</p>
          <p style="margin-top: 20px;">
            <a href="${env.CORS_ORIGIN}/subscriptions" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              View Subscription
            </a>
          </p>
        </div>
      `,
      [{
        filename: `invoice-${subscription._id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }]
    );
  }

  /** Returns the user's current active subscription, or null if expired/missing */
  async getUserSubscription(userId: string): Promise<ISubscription | null> {
    const subscription = await Subscription.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    // Check if subscription has expired
    if (subscription && subscription.endDate < new Date()) {
      subscription.status = SubscriptionStatus.EXPIRED;
      await subscription.save();
      return null;
    }

    return subscription;
  }

  /** Cancels the user's active subscription immediately */
  async cancelSubscription(userId: string): Promise<ISubscription> {
    const subscription = await Subscription.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
    });

    if (!subscription) {
      throw ApiError.notFound('No active subscription found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    await subscription.save();

    return subscription;
  }

  /** Handles Razorpay webhook events (payment captured, failed, subscription cancelled) */
  async webhookHandler(payload: any, signature: string): Promise<void> {
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw ApiError.badRequest('Invalid webhook signature');
    }

    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;

    switch (event) {
      case 'payment.captured': {
        // Payment successful - activate subscription if not already done
        if (paymentEntity?.order_id) {
          const subscription = await Subscription.findOne({
            razorpayOrderId: paymentEntity.order_id,
            status: SubscriptionStatus.PENDING,
          });

          if (subscription) {
            const plan = PLANS.find((p) => p.type === subscription.plan);
            const duration = plan ? plan.duration : 30;
            const now = new Date();
            const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

            subscription.status = SubscriptionStatus.ACTIVE;
            subscription.razorpayPaymentId = paymentEntity.id;
            subscription.startDate = now;
            subscription.endDate = endDate;
            await subscription.save();
          }
        }
        break;
      }

      case 'payment.failed': {
        // Payment failed - mark subscription as cancelled
        if (paymentEntity?.order_id) {
          const subscription = await Subscription.findOne({
            razorpayOrderId: paymentEntity.order_id,
            status: SubscriptionStatus.PENDING,
          });

          if (subscription) {
            subscription.status = SubscriptionStatus.CANCELLED;
            await subscription.save();
          }
        }
        break;
      }

      case 'subscription.cancelled': {
        const subscriptionEntity = payload.payload?.subscription?.entity;
        if (subscriptionEntity?.id) {
          const subscription = await Subscription.findOne({
            razorpaySubscriptionId: subscriptionEntity.id,
            status: SubscriptionStatus.ACTIVE,
          });

          if (subscription) {
            subscription.status = SubscriptionStatus.CANCELLED;
            await subscription.save();
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
    }
  }
}

export default new SubscriptionService();
