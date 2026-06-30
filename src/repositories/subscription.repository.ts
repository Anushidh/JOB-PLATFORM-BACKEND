import Subscription, { ISubscription, PlanType, SubscriptionStatus } from '../models/Subscription';
import { PaginationOptions, PaginatedResult } from '../types';

export class SubscriptionRepository {
  constructor(
    private readonly subscriptionModel: typeof Subscription = Subscription,
  ) {}

  findActiveByUser(userId: string) {
    return this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
    });
  }

  findActiveValidByUser(userId: string) {
    return this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });
  }

  findOneByOrderId(razorpayOrderId: string, status?: SubscriptionStatus) {
    const query: Record<string, unknown> = { razorpayOrderId };
    if (status) query.status = status;
    return this.subscriptionModel.findOne(query);
  }

  create(data: Record<string, unknown>) {
    return this.subscriptionModel.create(data);
  }

  findActiveSubscription(userId: string) {
    return this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
    });
  }

  findExpiredActive(now: Date) {
    return this.subscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lt: now },
    });
  }

  findExpiringWithin(now: Date, endDate: Date) {
    return this.subscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gte: now, $lte: endDate },
    });
  }

  findByRazorpaySubscriptionId(razorpaySubscriptionId: string) {
    return this.subscriptionModel.findOne({
      razorpaySubscriptionId,
      status: SubscriptionStatus.ACTIVE,
    });
  }

  aggregateRevenueStats() {
    return this.subscriptionModel.aggregate([
      { $match: { status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED] }, razorpayPaymentId: { $exists: true, $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
  }

  countActive(now: Date) {
    return this.subscriptionModel.countDocuments({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gte: now },
    });
  }

  aggregateMrr(now: Date) {
    return this.subscriptionModel.aggregate([
      { $match: { status: SubscriptionStatus.ACTIVE, endDate: { $gte: now } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  aggregateByPlan() {
    return this.subscriptionModel.aggregate([
      { $match: { razorpayPaymentId: { $exists: true, $ne: null } } },
      { $group: { _id: '$plan', count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      { $sort: { revenue: -1 } },
    ]);
  }

  aggregateByMonth(since: Date) {
    return this.subscriptionModel.aggregate([
      {
        $match: {
          startDate: { $gte: since },
          razorpayPaymentId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$startDate' }, month: { $month: '$startDate' } },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
  }

  findRecentPayments(limit: number) {
    return this.subscriptionModel.find({
      razorpayPaymentId: { $exists: true, $ne: null },
    })
      .sort({ startDate: -1 })
      .limit(limit)
      .select('user userRole plan amount currency razorpayPaymentId startDate');
  }

  async findPaymentHistory(options: PaginationOptions): Promise<PaginatedResult<ISubscription>> {
    const { page, limit, sort = 'startDate', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query = { razorpayPaymentId: { $exists: true, $ne: null } };

    const [payments, total] = await Promise.all([
      this.subscriptionModel.find(query)
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .select('user userRole plan amount currency status razorpayPaymentId razorpayOrderId startDate endDate createdAt'),
      this.subscriptionModel.countDocuments(query),
    ]);

    return {
      data: payments,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  findById(subscriptionId: string) {
    return this.subscriptionModel.findById(subscriptionId);
  }

  findActiveForFeatureCheck(userId: string) {
    return this.subscriptionModel.findOne({
      user: userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gte: new Date() },
    });
  }
}

export { PlanType, SubscriptionStatus };
