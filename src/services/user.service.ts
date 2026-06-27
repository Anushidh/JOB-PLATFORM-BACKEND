import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { ApiError } from '../utils/apiError';
import { IEmployee, IEmployer, IBaseUser, UserRole, PaginationOptions, PaginatedResult } from '../types';

class UserService {
  /** Fetches the authenticated user's profile based on their role */
  async getProfile(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findById(userId);
    } else if (role === UserRole.EMPLOYER) {
      user = await Employer.findById(userId).populate('company');
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  }

  /** Updates employee profile fields, blocking changes to sensitive fields like password and email */
  async updateEmployeeProfile(userId: string, updateData: Partial<IEmployee>): Promise<IEmployee> {
    // Prevent updating sensitive fields
    const forbiddenFields = ['password', 'email', 'isActive', 'isSuspended'];
    forbiddenFields.forEach((field) => {
      delete (updateData as any)[field];
    });

    const employee = await Employee.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!employee) {
      throw ApiError.notFound('Employee not found');
    }

    return employee;
  }

  /** Updates employer profile fields, blocking changes to sensitive fields like password and email */
  async updateEmployerProfile(userId: string, updateData: Partial<IEmployer>): Promise<IEmployer> {
    // Prevent updating sensitive fields
    const forbiddenFields = ['password', 'email', 'isActive', 'isSuspended'];
    forbiddenFields.forEach((field) => {
      delete (updateData as any)[field];
    });

    const employer = await Employer.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('company');

    if (!employer) {
      throw ApiError.notFound('Employer not found');
    }

    return employer;
  }

  /** Updates the employee's resume file path */
  async updateResume(userId: string, resumePath: string): Promise<IEmployee> {
    const employee = await Employee.findByIdAndUpdate(
      userId,
      { resumePath },
      { new: true }
    );
    if (!employee) {
      throw ApiError.notFound('Employee not found');
    }
    return employee;
  }

  /** Verifies current password and updates to new password */
  async changePassword(userId: string, role: UserRole, currentPassword: string, newPassword: string): Promise<void> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findById(userId).select('+password');
    } else {
      user = await Employer.findById(userId).select('+password');
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();
  }

  /** Returns public-facing employee profile (excludes private fields like email) */
  async getPublicEmployeeProfile(userId: string): Promise<Partial<IEmployee>> {
    const employee = await Employee.findById(userId)
      .select('firstName lastName avatar bio headline skills experience education portfolioLinks location');

    if (!employee) {
      throw ApiError.notFound('Employee not found');
    }

    return employee;
  }

  /** Returns public-facing employer profile with company info */
  async getPublicEmployerProfile(userId: string): Promise<Partial<IEmployer>> {
    const employer = await Employer.findById(userId)
      .select('firstName lastName avatar position department')
      .populate('company', 'name logoUrl industry description website');

    if (!employer) {
      throw ApiError.notFound('Employer not found');
    }

    return employer;
  }

  /** Searches employees by name, skills, or headline with pagination */
  async searchEmployees(
    query: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IEmployee>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query) {
      filter.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { skills: { $regex: query, $options: 'i' } },
        { headline: { $regex: query, $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .select('-password')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Employee.countDocuments(filter),
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

  /** Calculates profile completion percentage based on filled fields */
  calculateProfileCompletion(user: IEmployee | IEmployer, role: UserRole): { percentage: number; missingFields: string[] } {
    const missingFields: string[] = [];

    if (role === UserRole.EMPLOYEE) {
      const emp = user as IEmployee;
      const fields = [
        { name: 'Avatar', filled: !!emp.avatar },
        { name: 'Phone', filled: !!emp.phone },
        { name: 'Bio', filled: !!emp.bio },
        { name: 'Headline', filled: !!emp.headline },
        { name: 'Location', filled: !!emp.location },
        { name: 'Skills', filled: !!(emp.skills && emp.skills.length > 0) },
        { name: 'Experience', filled: !!(emp.experience && emp.experience.length > 0) },
        { name: 'Education', filled: !!(emp.education && emp.education.length > 0) },
        { name: 'Resume', filled: !!emp.resumePath },
        { name: 'Portfolio Links', filled: !!(emp.portfolioLinks && emp.portfolioLinks.length > 0) },
      ];

      fields.forEach(f => { if (!f.filled) missingFields.push(f.name); });
      const filled = fields.filter(f => f.filled).length;
      return { percentage: Math.round((filled / fields.length) * 100), missingFields };
    } else {
      const emp = user as IEmployer;
      const fields = [
        { name: 'Avatar', filled: !!emp.avatar },
        { name: 'Phone', filled: !!emp.phone },
        { name: 'Position', filled: !!emp.position },
        { name: 'Department', filled: !!emp.department },
        { name: 'Company', filled: !!emp.company },
      ];

      fields.forEach(f => { if (!f.filled) missingFields.push(f.name); });
      const filled = fields.filter(f => f.filled).length;
      return { percentage: Math.round((filled / fields.length) * 100), missingFields };
    }
  }
}

export default new UserService();
