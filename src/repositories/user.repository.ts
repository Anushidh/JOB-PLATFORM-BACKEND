import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { IEmployee, IEmployer, PaginationOptions, PaginatedResult } from '../types';

export class UserRepository {
  constructor(
    private readonly employeeModel: typeof Employee = Employee,
    private readonly employerModel: typeof Employer = Employer,
  ) {}

  findEmployeeById(userId: string) {
    return this.employeeModel.findById(userId);
  }

  findEmployerById(userId: string) {
    return this.employerModel.findById(userId).populate('company');
  }

  findEmployeeByIdWithPassword(userId: string) {
    return this.employeeModel.findById(userId).select('+password');
  }

  findEmployerByIdWithPassword(userId: string) {
    return this.employerModel.findById(userId).select('+password');
  }

  updateEmployee(userId: string, updateData: Partial<IEmployee>) {
    return this.employeeModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    );
  }

  updateEmployer(userId: string, updateData: Partial<IEmployer>) {
    return this.employerModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate('company');
  }

  updateEmployeeResume(userId: string, resumePath: string, resumePublicId?: string) {
    const update: Partial<IEmployee> = { resumePath };
    if (resumePublicId) {
      update.resumePublicId = resumePublicId;
    }
    return this.employeeModel.findByIdAndUpdate(userId, update, { new: true });
  }

  findPublicEmployee(userId: string) {
    return this.employeeModel.findById(userId)
      .select('firstName lastName avatar bio headline skills experience education portfolioLinks location');
  }

  findPublicEmployer(userId: string) {
    return this.employerModel.findById(userId)
      .select('firstName lastName avatar position department')
      .populate('company', 'name logoUrl industry description website');
  }

  findEmployeeByIdSelect(userId: string, select: string) {
    return this.employeeModel.findById(userId).select(select);
  }

  findEmployerByIdSelect(userId: string, select: string) {
    return this.employerModel.findById(userId).select(select);
  }

  async searchEmployees(
    query: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IEmployee>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query) {
      filter.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { skills: { $regex: query, $options: 'i' } },
        { headline: { $regex: query, $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      this.employeeModel.find(filter)
        .select('-password')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.employeeModel.countDocuments(filter),
    ]);

    return {
      data: employees,
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
