import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { NotificationRepository } from '../repositories/notification.repository';
import { UserRole, NotificationType } from '../types';

interface BroadcastData {
  title: string;
  message: string;
  target: 'all' | 'employees' | 'employers';
}

export class BroadcastService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async sendBroadcast(data: BroadcastData): Promise<{ recipientCount: number }> {
    const { title, message, target } = data;

    let recipients: { id: string; role: UserRole }[] = [];

    if (target === 'all' || target === 'employees') {
      const employees = await Employee.find({ isActive: true, isDeleted: { $ne: true } }).select('_id').lean();
      recipients.push(...employees.map((e) => ({ id: e._id.toString(), role: UserRole.EMPLOYEE })));
    }

    if (target === 'all' || target === 'employers') {
      const employers = await Employer.find({ isActive: true, isDeleted: { $ne: true } }).select('_id').lean();
      recipients.push(...employers.map((e) => ({ id: e._id.toString(), role: UserRole.EMPLOYER })));
    }

    if (recipients.length === 0) {
      return { recipientCount: 0 };
    }

    const notifications = recipients.map((r) => ({
      recipient: r.id,
      recipientRole: r.role,
      type: NotificationType.ACCOUNT_REACTIVATED,
      title,
      message,
    }));

    await this.notificationRepository.createMany(notifications);

    return { recipientCount: recipients.length };
  }
}
