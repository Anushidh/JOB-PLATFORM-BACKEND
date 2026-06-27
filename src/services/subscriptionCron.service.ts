import Subscription, { SubscriptionStatus } from '../models/Subscription';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { UserRole } from '../types';
import emailService from './email.service';
import env from '../config/env';

class SubscriptionCronService {
  /**
   * Mark expired subscriptions and send post-expiry email.
   * Runs daily — finds subscriptions where endDate < now and status is still active.
   */
  async processExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    const expiredSubscriptions = await Subscription.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lt: now },
    });

    for (const subscription of expiredSubscriptions) {
      try {
        // Mark as expired
        subscription.status = SubscriptionStatus.EXPIRED;
        await subscription.save();

        // Send post-expiry email
        const { email, name } = await this.getUserInfo(subscription.user.toString(), subscription.userRole as UserRole);
        if (email) {
          await emailService.sendWithAttachment(
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
            []
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

  /**
   * Send warning emails for subscriptions expiring in 3 days.
   * Runs daily — finds subscriptions where endDate is between now and now+3 days.
   */
  async sendExpiryWarnings(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find subscriptions expiring in the next 3 days that haven't been warned yet
    // We use a date range: endDate is between now and 3 days from now
    const expiringSubscriptions = await Subscription.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: {
        $gte: now,
        $lte: threeDaysFromNow,
      },
    });

    for (const subscription of expiringSubscriptions) {
      try {
        const { email, name } = await this.getUserInfo(subscription.user.toString(), subscription.userRole as UserRole);
        if (!email) continue;

        const daysLeft = Math.ceil(
          (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await emailService.sendWithAttachment(
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
          []
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

  /** Looks up email and name for a user by ID and role */
  private async getUserInfo(userId: string, role: UserRole): Promise<{ email: string; name: string }> {
    if (role === UserRole.EMPLOYEE) {
      const user = await Employee.findById(userId).select('email firstName');
      return { email: user?.email || '', name: user?.firstName || 'User' };
    } else if (role === UserRole.EMPLOYER) {
      const user = await Employer.findById(userId).select('email firstName');
      return { email: user?.email || '', name: user?.firstName || 'User' };
    }
    return { email: '', name: '' };
  }
}

export default new SubscriptionCronService();
