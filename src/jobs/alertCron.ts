import cron from 'node-cron';
import { jobAlertService, subscriptionCronService, jobRepository } from '../container';

const dailyAlertJob = cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Running job alert check...');
  try {
    await jobAlertService.checkAndSendAlerts();
    console.log('[Cron] Job alert check completed');
  } catch (error) {
    console.error('[Cron] Job alert check failed:', error);
  }
});

const expiryWarningJob = cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Running subscription expiry warning check...');
  try {
    await subscriptionCronService.sendExpiryWarnings();
    console.log('[Cron] Subscription expiry warning check completed');
  } catch (error) {
    console.error('[Cron] Subscription expiry warning check failed:', error);
  }
});

const expiryProcessJob = cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Processing expired subscriptions...');
  try {
    await subscriptionCronService.processExpiredSubscriptions();
    console.log('[Cron] Expired subscriptions processed');
  } catch (error) {
    console.error('[Cron] Expired subscriptions processing failed:', error);
  }
});

const jobExpiryCron = cron.schedule('0 1 * * *', async () => {
  console.log('[Cron] Checking for expired jobs...');
  try {
    const now = new Date();
    const result = await jobRepository.closeExpiredJobs(now);
    if (result.modifiedCount > 0) {
      console.log(`[Cron] Auto-closed ${result.modifiedCount} expired jobs`);
    }
  } catch (error) {
    console.error('[Cron] Job expiry check failed:', error);
  }
});

export function startCronJobs(): void {
  dailyAlertJob.start();
  expiryWarningJob.start();
  expiryProcessJob.start();
  jobExpiryCron.start();
  console.log('Cron jobs started:');
  console.log('  - Job alerts: daily at 8:00 AM');
  console.log('  - Subscription expiry warnings: daily at 9:00 AM');
  console.log('  - Expired subscription processing: daily at midnight');
  console.log('  - Job expiry auto-close: daily at 1:00 AM');
}

export function stopCronJobs(): void {
  dailyAlertJob.stop();
  expiryWarningJob.stop();
  expiryProcessJob.stop();
  jobExpiryCron.stop();
}
