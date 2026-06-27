import Notification from '../models/Notification';
import { ApiError } from '../utils/apiError';
import { INotification, NotificationType, ApplicationStatus, UserRole, PaginationOptions, PaginatedResult } from '../types';
import { emitNotification } from '../socket';

class NotificationService {
  /** Creates a notification record and emits it in real-time via Socket.IO */
  async createNotification(data: {
    recipient: string;
    recipientRole: UserRole;
    type: NotificationType;
    title: string;
    message: string;
    relatedId?: string;
    relatedModel?: string;
  }): Promise<INotification> {
    const notification = await Notification.create(data);

    // Emit real-time notification to recipient
    emitNotification(data.recipient, {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: false,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  /** Returns paginated notifications for a user, optionally filtering to unread only */
  async getUserNotifications(
    userId: string,
    role: UserRole,
    options: PaginationOptions,
    unreadOnly = false
  ): Promise<PaginatedResult<INotification>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query: any = { recipient: userId, recipientRole: role };
    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
    ]);

    return {
      data: notifications,
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

  /** Marks a single notification as read after verifying ownership */
  async markAsRead(notificationId: string, userId: string): Promise<INotification> {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.recipient.toString() !== userId) {
      throw ApiError.forbidden('You can only mark your own notifications as read');
    }

    notification.isRead = true;
    await notification.save();
    return notification;
  }

  /** Marks all unread notifications as read for the given user */
  async markAllAsRead(userId: string, role: UserRole): Promise<void> {
    await Notification.updateMany(
      { recipient: userId, recipientRole: role, isRead: false },
      { isRead: true }
    );
  }

  /** Returns the count of unread notifications for a user */
  async getUnreadCount(userId: string, role: UserRole): Promise<number> {
    return Notification.countDocuments({ recipient: userId, recipientRole: role, isRead: false });
  }

  /** Permanently deletes a notification after verifying ownership */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.recipient.toString() !== userId) {
      throw ApiError.forbidden('You can only delete your own notifications');
    }

    await Notification.findByIdAndDelete(notificationId);
  }

  /** Notifies an employer about a new application received */
  async notifyNewApplication(
    employerId: string,
    applicationId: string,
    jobTitle: string
  ): Promise<void> {
    await this.createNotification({
      recipient: employerId,
      recipientRole: UserRole.EMPLOYER,
      type: NotificationType.APPLICATION_RECEIVED,
      title: 'New Application Received',
      message: `A new application has been submitted for "${jobTitle}"`,
      relatedId: applicationId,
      relatedModel: 'Application',
    });
  }

  /** Notifies an applicant about a change in their application status */
  async notifyApplicationStatusChange(
    applicantId: string,
    applicationId: string,
    status: ApplicationStatus,
    jobTitle: string
  ): Promise<void> {
    const statusMessages: Record<ApplicationStatus, string> = {
      [ApplicationStatus.APPLIED]: `Your application for "${jobTitle}" has been received`,
      [ApplicationStatus.SHORTLISTED]: `Your application for "${jobTitle}" has been shortlisted`,
      [ApplicationStatus.REJECTED]: `Your application for "${jobTitle}" has been declined`,
      [ApplicationStatus.INTERVIEW]: `You've been invited for an interview for "${jobTitle}"`,
      [ApplicationStatus.OFFER]: `Congratulations! You've received an offer for "${jobTitle}"`,
      [ApplicationStatus.WITHDRAWN]: `Your application for "${jobTitle}" has been withdrawn`,
    };

    await this.createNotification({
      recipient: applicantId,
      recipientRole: UserRole.EMPLOYEE,
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      title: 'Application Status Updated',
      message: statusMessages[status],
      relatedId: applicationId,
      relatedModel: 'Application',
    });
  }

  /** Notifies an employer that their job listing was approved or rejected by admin */
  async notifyJobModeration(
    employerId: string,
    jobId: string,
    approved: boolean,
    jobTitle: string
  ): Promise<void> {
    await this.createNotification({
      recipient: employerId,
      recipientRole: UserRole.EMPLOYER,
      type: approved ? NotificationType.JOB_APPROVED : NotificationType.JOB_REJECTED,
      title: approved ? 'Job Approved' : 'Job Rejected',
      message: approved
        ? `Your job listing "${jobTitle}" has been approved and is now live`
        : `Your job listing "${jobTitle}" has been rejected by admin`,
      relatedId: jobId,
      relatedModel: 'Job',
    });
  }
}

export default new NotificationService();
