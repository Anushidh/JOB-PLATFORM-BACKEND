import { ApiError } from '../utils/apiError';
import { UserRepository } from '../repositories/user.repository';
import { IEmployee, IEmployer, UserRole, PaginationOptions, PaginatedResult } from '../types';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.userRepository.findEmployeeById(userId);
    } else if (role === UserRole.EMPLOYER) {
      user = await this.userRepository.findEmployerById(userId);
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  }

  async updateEmployeeProfile(userId: string, updateData: Partial<IEmployee>): Promise<IEmployee> {
    const forbiddenFields = ['password', 'email', 'isActive', 'isSuspended'];
    forbiddenFields.forEach((field) => {
      delete (updateData as Record<string, unknown>)[field];
    });

    const employee = await this.userRepository.updateEmployee(userId, updateData);

    if (!employee) {
      throw ApiError.notFound('Employee not found');
    }

    return employee;
  }

  async updateEmployerProfile(userId: string, updateData: Partial<IEmployer>): Promise<IEmployer> {
    const forbiddenFields = ['password', 'email', 'isActive', 'isSuspended'];
    forbiddenFields.forEach((field) => {
      delete (updateData as Record<string, unknown>)[field];
    });

    const employer = await this.userRepository.updateEmployer(userId, updateData);

    if (!employer) {
      throw ApiError.notFound('Employer not found');
    }

    return employer;
  }

  async updateResume(userId: string, resumePath: string): Promise<IEmployee> {
    const employee = await this.userRepository.updateEmployeeResume(userId, resumePath);
    if (!employee) {
      throw ApiError.notFound('Employee not found');
    }
    return employee;
  }

  async changePassword(userId: string, role: UserRole, currentPassword: string, newPassword: string): Promise<void> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.userRepository.findEmployeeByIdWithPassword(userId);
    } else {
      user = await this.userRepository.findEmployerByIdWithPassword(userId);
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

  async getPublicEmployeeProfile(userId: string): Promise<Partial<IEmployee>> {
    const employee = await this.userRepository.findPublicEmployee(userId);

    if (!employee) {
      throw ApiError.notFound('Employee not found');
    }

    return employee;
  }

  async getPublicEmployerProfile(userId: string): Promise<Partial<IEmployer>> {
    const employer = await this.userRepository.findPublicEmployer(userId);

    if (!employer) {
      throw ApiError.notFound('Employer not found');
    }

    return employer;
  }

  async searchEmployees(
    query: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IEmployee>> {
    return this.userRepository.searchEmployees(query, options);
  }

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
    }

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
