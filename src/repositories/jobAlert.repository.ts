import JobAlert, { IJobAlert } from '../models/JobAlert';

export class JobAlertRepository {
  constructor(
    private readonly jobAlertModel: typeof JobAlert = JobAlert,
  ) {}

  countByEmployee(employeeId: string) {
    return this.jobAlertModel.countDocuments({ employee: employeeId });
  }

  create(data: Record<string, unknown>) {
    return this.jobAlertModel.create(data);
  }

  findByIdAndEmployee(alertId: string, employeeId: string) {
    return this.jobAlertModel.findOne({ _id: alertId, employee: employeeId });
  }

  deleteById(alertId: string) {
    return this.jobAlertModel.deleteOne({ _id: alertId });
  }

  findByEmployee(employeeId: string): Promise<IJobAlert[]> {
    return this.jobAlertModel.find({ employee: employeeId }).sort({ createdAt: -1 });
  }

  findActiveByFrequency(frequencies: string[]) {
    return this.jobAlertModel.find({
      isActive: true,
      frequency: { $in: frequencies },
    }).populate('employee', 'email firstName');
  }

  findActiveInstant() {
    return this.jobAlertModel.find({
      isActive: true,
      frequency: 'instant',
    }).populate('employee', 'email firstName');
  }
}
