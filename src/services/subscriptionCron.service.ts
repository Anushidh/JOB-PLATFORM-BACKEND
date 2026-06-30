import { SubscriptionRepository } from '../repositories/subscription.repository';
import { AdminRepository } from '../repositories/admin.repository';
import { EmailService } from './email.service';
import { SubscriptionStatus } from '../models/Subscription';
import { UserRole } from '../types';
import env from '../config/env';

export class SubscriptionCronService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly adminRepository: AdminRepository,
    private readonly emailService: EmailService,
  ) {}

  async processExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    const expiredSubscriptions = await this.subscriptionRepository.findExpiredActive(now);

    for (const subscription of expiredSubscriptions) {
      try {
        subscription.status = SubscriptionStatus.EXPIRED;
        await subscription.save();

        const { email, name } = await this.getUserInfo(subscription.user.toString(), subscription.userRole as UserRole);
        if (email) {
          await this.emailService.sendWithAttachment(
            email,
            'Your Subscription Has Expired - Job Platform',
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Hi ${name},</h2>
                <p>Your <strong>${subscription.plan}</strong> plan subscription has expired.</p>
                <p>You've been moved to the Free plan with limited features. To continue enjoying premium benefits, please renew your subscription.</p>
                <p style="margin-top: 20px;">
                  <a href="${env.CORS_ORIGIN}/subscriptions" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                    Renew Subscription
                  </a>
                </p>
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  If you have any questions, contact us at support@jobplatform.com
                </p>
              </div>
            `,
            [],
          );
        }

        console.log(`[SubscriptionCron] Expired subscription ${subscription._id} for user ${subscription.user}`);
      } catch (error) {
        console.error(`[SubscriptionCron] Error processing expired subscription ${subscription._id}:`, error);
      }
    }

    if (expiredSubscriptions.length > 0) {
      console.log(`[SubscriptionCron] Processed ${expiredSubscriptions.length} expired subscriptions`);
    }
  }

  async sendExpiryWarnings(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringSubscriptions = await this.subscriptionRepository.findExpiringWithin(now, threeDaysFromNow);

    for (const subscription of expiringSubscriptions) {
      try {
        const { email, name } = await this.getUserInfo(subscription.user.toString(), subscription.userRole as UserRole);
        if (!email) continue;

        const daysLeft = Math.ceil(
          (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        await this.emailService.sendWithAttachment(
          email,
          `Your Subscription Expires in ${daysLeft} Day${daysLeft > 1 ? 's' : ''} - Job Platform`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Hi ${name},</h2>
              <p>Your <strong>${subscription.plan}</strong> plan subscription will expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong> (on ${subscription.endDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}).</p>
              <p>After expiry, you'll be moved to the Free plan with limited features:</p>
              <ul>
                <li>Max 3 job posts (employers)</li>
                <li>Max 10 applications per month (employees)</li>
                <li>No analytics access</li>
                <li>No premium placement</li>
              </ul>
              <p>Renew now to avoid any interruption:</p>
              <p style="margin-top: 20px;">
                <a href="${env.CORS_ORIGIN}/subscriptions" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                  Renew Subscription
                </a>
              </p>
            </div>
          `,
          [],
        );

        console.log(`[SubscriptionCron] Sent expiry warning to ${email} (${daysLeft} days left)`);
      } catch (error) {
        console.error(`[SubscriptionCron] Error sending expiry warning for ${subscription._id}:`, error);
      }
    }

    if (expiringSubscriptions.length > 0) {
      console.log(`[SubscriptionCron] Sent ${expiringSubscriptions.length} expiry warnings`);
    }
  }

  private async getUserInfo(userId: string, role: UserRole): Promise<{ email: string; name: string }> {
    const user = await this.adminRepository.findUserBasicInfo(userId, role);
    return { email: user?.email || '', name: user?.firstName || 'User' };
  }
}
