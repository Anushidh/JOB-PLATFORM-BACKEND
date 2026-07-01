import { ApiError } from '../utils/apiError';
import { AdminRepository } from '../repositories/admin.repository';
import { JobRepository } from '../repositories/job.repository';
import { ApplicationRepository } from '../repositories/application.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { NotificationService } from './notification.service';
import { TokenService } from './token.service';
import { JobAlertService } from './jobAlert.service';
import { IEmployee, IEmployer, IJob, JobStatus, UserRole, PaginationOptions, PaginatedResult, NotificationType } from '../types';

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly jobRepository: JobRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly notificationService: NotificationService,
    private readonly tokenService: TokenService,
    private readonly jobAlertService: JobAlertService,
  ) {}

  async getAllEmployees(
    options: PaginationOptions,
    search?: string,
  ): Promise<PaginatedResult<IEmployee>> {
    return this.adminRepository.findAllEmployees(options, search);
  }

  async getAllEmployers(
    options: PaginationOptions,
    search?: string,
  ): Promise<PaginatedResult<IEmployer>> {
    return this.adminRepository.findAllEmployers(options, search);
  }

  async getUserDetail(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.adminRepository.findEmployeeById(userId);
    } else {
      user = await this.adminRepository.findEmployerById(userId);
      // Populate company for employers
      if (user && (user as any).company) {
        const company = await this.companyRepository.findById((user as any).company.toString());
        if (company) {
          (user as any).company = company;
        }
      }
    }

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async suspendUser(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.adminRepository.findEmployeeById(userId);
    } else {
      user = await this.adminRepository.findEmployerById(userId);
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    user.isSuspended = true;
    await user.save();

    await this.tokenService.revokeAllUserTokens(userId, role);

    await this.notificationService.createNotification({
      recipient: userId,
      recipientRole: role,
      type: NotificationType.ACCOUNT_SUSPENDED,
      title: 'Account Suspended',
      message: 'Your account has been suspended by an administrator',
    });

    return user;
  }

  async reactivateUser(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.adminRepository.findEmployeeById(userId);
    } else {
      user = await this.adminRepository.findEmployerById(userId);
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    user.isSuspended = false;
    await user.save();

    await this.notificationService.createNotification({
      recipient: userId,
      recipientRole: role,
      type: NotificationType.ACCOUNT_REACTIVATED,
      title: 'Account Reactivated',
      message: 'Your account has been reactivated by an administrator',
    });

    return user;
  }

  async deleteUser(userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.EMPLOYEE) {
      const employee = await this.adminRepository.findEmployeeById(userId);
      if (!employee) throw ApiError.notFound('User not found');
      employee.isDeleted = true;
      employee.deletedAt = new Date();
      employee.isActive = false;
      await employee.save();
    } else if (role === UserRole.EMPLOYER) {
      const employer = await this.adminRepository.findEmployerById(userId);
      if (!employer) throw ApiError.notFound('User not found');

      const activeJobCount = await this.jobRepository.countByEmployerAndStatus(
        userId,
        [JobStatus.ACTIVE, JobStatus.PENDING],
      );

      if (activeJobCount > 0) {
        throw ApiError.badRequest(
          `Cannot delete account. You have ${activeJobCount} active/pending job(s). Close or delete them first.`,
        );
      }

      employer.isDeleted = true;
      employer.deletedAt = new Date();
      employer.isActive = false;
      await employer.save();
      await this.jobRepository.softDeleteByEmployer(userId);
    }

    await this.tokenService.revokeAllUserTokens(userId, role);
  }

  async getPendingJobs(options: PaginationOptions): Promise<PaginatedResult<IJob>> {
    return this.jobRepository.findPending(options);
  }

  async approveJob(jobId: string): Promise<IJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.status !== JobStatus.PENDING) {
      throw ApiError.badRequest('Only pending jobs can be approved');
    }

    job.status = JobStatus.ACTIVE;
    await job.save();

    await this.notificationService.notifyJobModeration(
      job.employer.toString(),
      job._id.toString(),
      true,
      job.title,
    );

    this.jobAlertService.checkInstantAlerts(job._id.toString()).catch((err) =>
      console.error('[JobAlert] Error checking instant alerts:', err),
    );

    return job.populate(['company', 'employer']);
  }

  async rejectJob(jobId: string, _reason?: string): Promise<IJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.status !== JobStatus.PENDING) {
      throw ApiError.badRequest('Only pending jobs can be rejected');
    }

    job.status = JobStatus.REJECTED;
    await job.save();

    await this.notificationService.notifyJobModeration(
      job.employer.toString(),
      job._id.toString(),
      false,
      job.title,
    );

    return job.populate(['company', 'employer']);
  }

  async getPlatformStats(): Promise<{
    totalEmployees: number;
    totalEmployers: number;
    totalJobs: number;
    activeJobs: number;
    pendingJobs: number;
    totalApplications: number;
    totalCompanies: number;
  }> {
    const [
      totalEmployees,
      totalEmployers,
      totalJobs,
      activeJobs,
      pendingJobs,
      totalApplications,
      totalCompanies,
    ] = await Promise.all([
      this.adminRepository.countEmployees(),
      this.adminRepository.countEmployers(),
      this.jobRepository.countDocuments(),
      this.jobRepository.countDocuments({ status: JobStatus.ACTIVE }),
      this.jobRepository.countDocuments({ status: JobStatus.PENDING }),
      this.applicationRepository.countDocuments(),
      this.companyRepository.countDocuments(),
    ]);

    return {
      totalEmployees,
      totalEmployers,
      totalJobs,
      activeJobs,
      pendingJobs,
      totalApplications,
      totalCompanies,
    };
  }
}
