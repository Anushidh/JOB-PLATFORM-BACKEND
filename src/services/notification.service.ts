import { ApiError } from '../utils/apiError';
import { NotificationRepository } from '../repositories/notification.repository';
import { RealtimeAdapter } from './adapters/realtime.adapter';
import { INotification, NotificationType, ApplicationStatus, UserRole, PaginationOptions, PaginatedResult } from '../types';

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly realtimeAdapter: RealtimeAdapter,
  ) {}

  async createNotification(data: {
    recipient: string;
    recipientRole: UserRole;
    type: NotificationType;
    title: string;
    message: string;
    relatedId?: string;
    relatedModel?: string;
  }): Promise<INotification> {
    const notification = await this.notificationRepository.create(data);

    this.realtimeAdapter.emitNotification(data.recipient, {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: false,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  async getUserNotifications(
    userId: string,
    role: UserRole,
    options: PaginationOptions,
    unreadOnly = false,
  ): Promise<PaginatedResult<INotification>> {
    return this.notificationRepository.findByUser(userId, role, options, unreadOnly);
  }

  async markAsRead(notificationId: string, userId: string): Promise<INotification> {
    const notification = await this.notificationRepository.findById(notificationId);
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

  async markAllAsRead(userId: string, role: UserRole): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId, role);
  }

  async getUnreadCount(userId: string, role: UserRole): Promise<number> {
    return this.notificationRepository.countUnread(userId, role);
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.recipient.toString() !== userId) {
      throw ApiError.forbidden('You can only delete your own notifications');
    }

    await this.notificationRepository.deleteById(notificationId);
  }

  async notifyNewApplication(
    employerId: string,
    applicationId: string,
    jobTitle: string,
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

  async notifyApplicationStatusChange(
    applicantId: string,
    applicationId: string,
    status: ApplicationStatus,
    jobTitle: string,
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

  async notifyJobModeration(
    employerId: string,
    jobId: string,
    approved: boolean,
    jobTitle: string,
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
