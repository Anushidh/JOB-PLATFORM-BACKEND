import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SubscriptionStatus } from '../models/Subscription';
import { PaginationOptions, PaginatedResult } from '../types';

interface RevenueStats {
  totalRevenue: number;
  mrr: number;
  activeSubscriptions: number;
  totalTransactions: number;
  revenueByPlan: { plan: string; count: number; revenue: number }[];
  revenueByMonth: { month: string; revenue: number; transactions: number }[];
  recentPayments: {
    user: string;
    userRole: string;
    plan: string;
    amount: number;
    currency: string;
    paymentId: string;
    date: Date;
  }[];
}

export class RevenueService {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async getRevenueStats(): Promise<RevenueStats> {
    const now = new Date();

    const totalRevenueAgg = await this.subscriptionRepository.aggregateRevenueStats();
    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const totalTransactions = totalRevenueAgg[0]?.count || 0;

    const activeSubscriptions = await this.subscriptionRepository.countActive(now);

    const mrrAgg = await this.subscriptionRepository.aggregateMrr(now);
    const mrr = mrrAgg[0]?.total || 0;

    const revenueByPlan = await this.subscriptionRepository.aggregateByPlan();

    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const revenueByMonth = await this.subscriptionRepository.aggregateByMonth(twelveMonthsAgo);

    const formattedRevenueByMonth = revenueByMonth.map((item: { _id: { year: number; month: number }; revenue: number; transactions: number }) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.revenue,
      transactions: item.transactions,
    }));

    const recentPayments = await this.subscriptionRepository.findRecentPayments(20);

    const formattedRecentPayments = recentPayments.map((sub) => ({
      user: sub.user.toString(),
      userRole: sub.userRole,
      plan: sub.plan,
      amount: sub.amount,
      currency: sub.currency,
      paymentId: sub.razorpayPaymentId || '',
      date: sub.startDate,
    }));

    return {
      totalRevenue,
      mrr,
      activeSubscriptions,
      totalTransactions,
      revenueByPlan: revenueByPlan.map((item: { _id: string; count: number; revenue: number }) => ({
        plan: item._id,
        count: item.count,
        revenue: item.revenue,
      })),
      revenueByMonth: formattedRevenueByMonth,
      recentPayments: formattedRecentPayments,
    };
  }

  async getPaymentHistory(options: PaginationOptions): Promise<PaginatedResult<unknown>> {
    return this.subscriptionRepository.findPaymentHistory(options);
  }
}

export { SubscriptionStatus };
