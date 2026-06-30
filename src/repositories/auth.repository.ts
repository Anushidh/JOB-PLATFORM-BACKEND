import Employee from '../models/Employee';
import Employer from '../models/Employer';
import Admin from '../models/Admin';
import { UserRole } from '../types';

export class AuthRepository {
  constructor(
    private readonly employeeModel: typeof Employee = Employee,
    private readonly employerModel: typeof Employer = Employer,
    private readonly adminModel: typeof Admin = Admin,
  ) {}

  findEmployeeByEmail(email: string) {
    return this.employeeModel.findOne({ email });
  }

  findEmployerByEmail(email: string) {
    return this.employerModel.findOne({ email });
  }

  findEmployeeByEmailWithPassword(email: string) {
    return this.employeeModel.findOne({ email, isDeleted: false }).select('+password');
  }

  findEmployerByEmailWithPassword(email: string) {
    return this.employerModel.findOne({ email, isDeleted: false }).select('+password');
  }

  findAdminByEmailWithPassword(email: string) {
    return this.adminModel.findOne({ email }).select('+password');
  }

  findEmployeeByEmailWithPasswordReset(email: string) {
    return this.employeeModel.findOne({ email }).select('+password');
  }

  findEmployerByEmailWithPasswordReset(email: string) {
    return this.employerModel.findOne({ email }).select('+password');
  }

  createEmployee(data: Record<string, unknown>) {
    return this.employeeModel.create(data);
  }

  createEmployer(data: Record<string, unknown>) {
    return this.employerModel.create(data);
  }

  findUserById(userId: string, role: UserRole) {
    if (role === UserRole.EMPLOYEE) {
      return this.employeeModel.findById(userId);
    }
    if (role === UserRole.EMPLOYER) {
      return this.employerModel.findById(userId);
    }
    if (role === UserRole.ADMIN) {
      return this.adminModel.findById(userId);
    }
    return null;
  }

  updateLastActive(userId: string, role: UserRole): void {
    if (role === UserRole.EMPLOYEE) {
      this.employeeModel.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).exec().catch(() => {});
    } else if (role === UserRole.EMPLOYER) {
      this.employerModel.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).exec().catch(() => {});
    }
  }
}
