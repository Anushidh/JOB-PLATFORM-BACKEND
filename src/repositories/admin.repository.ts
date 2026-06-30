import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { IEmployee, IEmployer, UserRole, PaginationOptions, PaginatedResult } from '../types';

export class AdminRepository {
  constructor(
    private readonly employeeModel: typeof Employee = Employee,
    private readonly employerModel: typeof Employer = Employer,
  ) {}

  async findAllEmployees(
    options: PaginationOptions,
    search?: string,
  ): Promise<PaginatedResult<IEmployee>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      this.employeeModel.find(query)
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.employeeModel.countDocuments(query),
    ]);

    return {
      data: employees,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findAllEmployers(
    options: PaginationOptions,
    search?: string,
  ): Promise<PaginatedResult<IEmployer>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [employers, total] = await Promise.all([
      this.employerModel.find(query)
        .populate('company', 'name')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.employerModel.countDocuments(query),
    ]);

    return {
      data: employers,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  findEmployeeById(userId: string) {
    return this.employeeModel.findById(userId);
  }

  findEmployerById(userId: string) {
    return this.employerModel.findById(userId);
  }

  countEmployees() {
    return this.employeeModel.countDocuments();
  }

  countEmployers() {
    return this.employerModel.countDocuments();
  }

  findUserEmailInfo(userId: string, role: UserRole) {
    if (role === UserRole.EMPLOYEE) {
      return this.employeeModel.findById(userId).select('email firstName lastName billingState');
    }
    if (role === UserRole.EMPLOYER) {
      return this.employerModel.findById(userId).select('email firstName lastName billingState');
    }
    return null;
  }

  findUserBasicInfo(userId: string, role: UserRole) {
    if (role === UserRole.EMPLOYEE) {
      return this.employeeModel.findById(userId).select('email firstName');
    }
    if (role === UserRole.EMPLOYER) {
      return this.employerModel.findById(userId).select('email firstName');
    }
    return null;
  }
}
