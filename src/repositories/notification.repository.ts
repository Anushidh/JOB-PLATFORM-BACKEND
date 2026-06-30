import Notification from '../models/Notification';
import { INotification, UserRole, PaginationOptions, PaginatedResult } from '../types';

export class NotificationRepository {
  constructor(
    private readonly notificationModel: typeof Notification = Notification,
  ) {}

  create(data: Record<string, unknown>) {
    return this.notificationModel.create(data);
  }

  async findByUser(
    userId: string,
    role: UserRole,
    options: PaginationOptions,
    unreadOnly = false,
  ): Promise<PaginatedResult<INotification>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { recipient: userId, recipientRole: role };
    if (unreadOnly) query.isRead = false;

    const [notifications, total] = await Promise.all([
      this.notificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.notificationModel.countDocuments(query),
    ]);

    return {
      data: notifications,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  findById(notificationId: string) {
    return this.notificationModel.findById(notificationId);
  }

  markAllAsRead(userId: string, role: UserRole) {
    return this.notificationModel.updateMany(
      { recipient: userId, recipientRole: role, isRead: false },
      { isRead: true },
    );
  }

  countUnread(userId: string, role: UserRole) {
    return this.notificationModel.countDocuments({ recipient: userId, recipientRole: role, isRead: false });
  }

  deleteById(notificationId: string) {
    return this.notificationModel.findByIdAndDelete(notificationId);
  }
}
