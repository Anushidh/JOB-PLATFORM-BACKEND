import Subscription, { SubscriptionStatus, PlanType } from '../models/Subscription';
import { PaginationOptions, PaginatedResult } from '../types';

interface RevenueStats {
  totalRevenue: number;
  mrr: number; // Monthly Recurring Revenue
  activeSubscriptions: number;
  totalTransactions: number;
  revenueByPlan: {
    plan: string;
    count: number;
    revenue: number;
  }[];
  revenueByMonth: {
    month: string;
    revenue: number;
    transactions: number;
  }[];
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

class RevenueService {
  /** Retrieves revenue statistics including totals, MRR, plan breakdown, and monthly trends */
  async getRevenueStats(): Promise<RevenueStats> {
    const now = new Date();

    // Total revenue (all successful payments)
    const totalRevenueAgg = await Subscription.aggregate([
      { $match: { status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED] }, razorpayPaymentId: { $exists: true, $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const totalTransactions = totalRevenueAgg[0]?.count || 0;

    // Active subscriptions count
    const activeSubscriptions = await Subscription.countDocuments({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gte: now },
    });

    // MRR - sum of all active subscription amounts
    const mrrAgg = await Subscription.aggregate([
      { $match: { status: SubscriptionStatus.ACTIVE, endDate: { $gte: now } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const mrr = mrrAgg[0]?.total || 0;

    // Revenue by plan
    const revenueByPlan = await Subscription.aggregate([
      { $match: { razorpayPaymentId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Revenue by month (last 12 months)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const revenueByMonth = await Subscription.aggregate([
      {
        $match: {
          startDate: { $gte: twelveMonthsAgo },
          razorpayPaymentId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$startDate' },
            month: { $month: '$startDate' },
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const formattedRevenueByMonth = revenueByMonth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.revenue,
      transactions: item.transactions,
    }));

    // Recent payments (last 20)
    const recentPayments = await Subscription.find({
      razorpayPaymentId: { $exists: true, $ne: null },
    })
      .sort({ startDate: -1 })
      .limit(20)
      .select('user userRole plan amount currency razorpayPaymentId startDate');

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
      revenueByPlan: revenueByPlan.map((item) => ({
        plan: item._id,
        count: item.count,
        revenue: item.revenue,
      })),
      revenueByMonth: formattedRevenueByMonth,
      recentPayments: formattedRecentPayments,
    };
  }

  /** Returns paginated payment history for admin review */
  async getPaymentHistory(
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { page, limit, sort = 'startDate', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query = { razorpayPaymentId: { $exists: true, $ne: null } };

    const [payments, total] = await Promise.all([
      Subscription.find(query)
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .select('user userRole plan amount currency status razorpayPaymentId razorpayOrderId startDate endDate createdAt'),
      Subscription.countDocuments(query),
    ]);

    return {
      data: payments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }
}

export default new RevenueService();
