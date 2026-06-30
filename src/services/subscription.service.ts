import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ISubscription, PlanType, SubscriptionStatus } from '../models/Subscription';
import { ApiError } from '../utils/apiError';
import env from '../config/env';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { AdminRepository } from '../repositories/admin.repository';
import { InvoiceService } from './invoice.service';
import { EmailService } from './email.service';
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
  duration: number;
  gst: { rate: number; baseAmount: number; cgst: number; sgst: number };
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
    features: { maxJobPosts: 3, maxApplications: 10, premiumPlacement: false, resumeAccess: false, analyticsAccess: false },
  },
  {
    type: PlanType.BASIC,
    name: 'Basic',
    amount: 99900,
    currency: 'INR',
    duration: 30,
    gst: calculateGst(99900),
    features: { maxJobPosts: 10, maxApplications: 50, premiumPlacement: false, resumeAccess: true, analyticsAccess: true },
  },
  {
    type: PlanType.PREMIUM,
    name: 'Premium',
    amount: 249900,
    currency: 'INR',
    duration: 30,
    gst: calculateGst(249900),
    features: { maxJobPosts: 50, maxApplications: 200, premiumPlacement: true, resumeAccess: true, analyticsAccess: true },
  },
  {
    type: PlanType.ENTERPRISE,
    name: 'Enterprise',
    amount: 999900,
    currency: 'INR',
    duration: 30,
    gst: calculateGst(999900),
    features: { maxJobPosts: undefined, maxApplications: undefined, premiumPlacement: true, resumeAccess: true, analyticsAccess: true },
  },
];

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly adminRepository: AdminRepository,
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
  ) {}

  getPlans(): PlanDetails[] {
    return PLANS;
  }

  async createOrder(
    userId: string,
    userRole: string,
    planType: PlanType,
  ): Promise<{ order: unknown; subscription: ISubscription }> {
    const plan = PLANS.find((p) => p.type === planType);
    if (!plan) {
      throw ApiError.badRequest('Invalid plan type');
    }

    if (plan.type === PlanType.FREE) {
      throw ApiError.badRequest('Free plan does not require payment');
    }

    const existingSubscription = await this.subscriptionRepository.findActiveByUser(userId);

    if (existingSubscription) {
      throw ApiError.conflict('You already have an active subscription. Cancel it first to switch plans.');
    }

    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `sub_${userId}_${Date.now()}`,
      notes: { userId, userRole, planType },
    });

    const subscription = await this.subscriptionRepository.create({
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

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<ISubscription> {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw ApiError.badRequest('Invalid payment signature');
    }

    const subscription = await this.subscriptionRepository.findOneByOrderId(
      razorpayOrderId,
      SubscriptionStatus.PENDING,
    );

    if (!subscription) {
      throw ApiError.notFound('Subscription not found or already processed');
    }

    const plan = PLANS.find((p) => p.type === subscription.plan);
    const duration = plan ? plan.duration : 30;

    const now = new Date();
    const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.razorpayPaymentId = razorpayPaymentId;
    subscription.startDate = now;
    subscription.endDate = endDate;
    await subscription.save();

    this.sendInvoiceEmail(subscription).catch((err) =>
      console.error('[Invoice] Failed to send invoice email:', err),
    );

    return subscription;
  }

  private async sendInvoiceEmail(subscription: ISubscription): Promise<void> {
    const user = await this.adminRepository.findUserBasicInfo(
      subscription.user.toString(),
      subscription.userRole as UserRole,
    );

    if (!user?.email) return;

    const pdfBuffer = await this.invoiceService.generateInvoicePdf(subscription);
    const amount = (subscription.amount / 100).toLocaleString('en-IN');

    await this.emailService.sendWithAttachment(
      user.email,
      'Payment Confirmation & Invoice - Job Platform',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hi ${user.firstName},</h2>
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
      }],
    );
  }

  async getUserSubscription(userId: string): Promise<ISubscription | null> {
    const subscription = await this.subscriptionRepository.findActiveValidByUser(userId);

    if (subscription && subscription.endDate < new Date()) {
      subscription.status = SubscriptionStatus.EXPIRED;
      await subscription.save();
      return null;
    }

    return subscription;
  }

  async cancelSubscription(userId: string): Promise<ISubscription> {
    const subscription = await this.subscriptionRepository.findActiveSubscription(userId);

    if (!subscription) {
      throw ApiError.notFound('No active subscription found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    await subscription.save();

    return subscription;
  }

  async webhookHandler(payload: unknown, signature: string): Promise<void> {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw ApiError.badRequest('Invalid webhook signature');
    }

    const body = payload as {
      event: string;
      payload?: {
        payment?: { entity?: { order_id?: string; id?: string } };
        subscription?: { entity?: { id?: string } };
      };
    };

    const event = body.event;
    const paymentEntity = body.payload?.payment?.entity;

    switch (event) {
      case 'payment.captured': {
        if (paymentEntity?.order_id) {
          const subscription = await this.subscriptionRepository.findOneByOrderId(
            paymentEntity.order_id,
            SubscriptionStatus.PENDING,
          );

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
        if (paymentEntity?.order_id) {
          const subscription = await this.subscriptionRepository.findOneByOrderId(
            paymentEntity.order_id,
            SubscriptionStatus.PENDING,
          );

          if (subscription) {
            subscription.status = SubscriptionStatus.CANCELLED;
            await subscription.save();
          }
        }
        break;
      }

      case 'subscription.cancelled': {
        const subscriptionEntity = body.payload?.subscription?.entity;
        if (subscriptionEntity?.id) {
          const subscription = await this.subscriptionRepository.findByRazorpaySubscriptionId(
            subscriptionEntity.id,
          );

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
