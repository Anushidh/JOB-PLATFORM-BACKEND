import Employee from '../models/Employee';
import Employer from '../models/Employer';
import Job from '../models/Job';
import Application from '../models/Application';
import Company from '../models/Company';
import { ApiError } from '../utils/apiError';
import { IEmployee, IEmployer, IJob, JobStatus, UserRole, PaginationOptions, PaginatedResult, NotificationType } from '../types';
import notificationService from './notification.service';
import tokenService from './token.service';
import jobAlertService from './jobAlert.service';

class AdminService {
  /** Returns a paginated list of all employees, optionally filtered by name/email search */
  async getAllEmployees(
    options: PaginationOptions,
    search?: string
  ): Promise<PaginatedResult<IEmployee>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Employee.countDocuments(query),
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

  /** Returns a paginated list of all employers with company info, optionally filtered by search */
  async getAllEmployers(
    options: PaginationOptions,
    search?: string
  ): Promise<PaginatedResult<IEmployer>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [employers, total] = await Promise.all([
      Employer.find(query)
        .populate('company', 'name')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Employer.countDocuments(query),
    ]);

    return {
      data: employers,
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

  /** Suspends a user account, revokes all tokens, and sends a suspension notification */
  async suspendUser(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findById(userId);
    } else {
      user = await Employer.findById(userId);
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    user.isSuspended = true;
    await user.save();

    // Revoke all tokens
    await tokenService.revokeAllUserTokens(userId, role);

    await notificationService.createNotification({
      recipient: userId,
      recipientRole: role,
      type: NotificationType.ACCOUNT_SUSPENDED,
      title: 'Account Suspended',
      message: 'Your account has been suspended by an administrator',
    });

    return user;
  }

  /** Removes suspension from a user and sends a reactivation notification */
  async reactivateUser(userId: string, role: UserRole): Promise<IEmployee | IEmployer> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findById(userId);
    } else {
      user = await Employer.findById(userId);
    }

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    user.isSuspended = false;
    await user.save();

    await notificationService.createNotification({
      recipient: userId,
      recipientRole: role,
      type: NotificationType.ACCOUNT_REACTIVATED,
      title: 'Account Reactivated',
      message: 'Your account has been reactivated by an administrator',
    });

    return user;
  }

  /** Soft-deletes a user. Blocks deletion if employer has active/pending jobs with applications. */
  async deleteUser(userId: string, role: UserRole): Promise<void> {
    if (role === UserRole.EMPLOYEE) {
      const employee = await Employee.findById(userId);
      if (!employee) throw ApiError.notFound('User not found');
      employee.isDeleted = true;
      employee.deletedAt = new Date();
      employee.isActive = false;
      await employee.save();
    } else if (role === UserRole.EMPLOYER) {
      const employer = await Employer.findById(userId);
      if (!employer) throw ApiError.notFound('User not found');

      // Block deletion if employer has active/pending jobs
      const activeJobCount = await Job.countDocuments({
        employer: userId,
        isDeleted: false,
        status: { $in: [JobStatus.ACTIVE, JobStatus.PENDING] },
      });

      if (activeJobCount > 0) {
        throw ApiError.badRequest(
          `Cannot delete account. You have ${activeJobCount} active/pending job(s). Close or delete them first.`
        );
      }

      employer.isDeleted = true;
      employer.deletedAt = new Date();
      employer.isActive = false;
      await employer.save();
      // Soft delete employer's remaining jobs (drafts, closed)
      await Job.updateMany(
        { employer: userId, isDeleted: false },
        { isDeleted: true, deletedAt: new Date(), status: JobStatus.CLOSED }
      );
    }

    // Revoke all tokens
    await tokenService.revokeAllUserTokens(userId, role);
  }

  /** Returns paginated list of jobs pending admin review */
  async getPendingJobs(options: PaginationOptions): Promise<PaginatedResult<IJob>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query = { status: JobStatus.PENDING };

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('company', 'name logoUrl')
        .populate('employer', 'firstName lastName email')
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(query),
    ]);

    return {
      data: jobs,
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

  /** Approves a pending job, notifies the employer, and triggers instant job alerts */
  async approveJob(jobId: string): Promise<IJob> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.status !== JobStatus.PENDING) {
      throw ApiError.badRequest('Only pending jobs can be approved');
    }

    job.status = JobStatus.ACTIVE;
    await job.save();

    await notificationService.notifyJobModeration(
      job.employer.toString(),
      job._id.toString(),
      true,
      job.title
    );

    // Trigger instant job alerts for matching employees
    jobAlertService.checkInstantAlerts(job._id.toString()).catch((err) =>
      console.error('[JobAlert] Error checking instant alerts:', err)
    );

    return job.populate(['company', 'employer']);
  }

  /** Rejects a pending job and notifies the employer */
  async rejectJob(jobId: string, _reason?: string): Promise<IJob> {
    const job = await Job.findById(jobId);
    if (!job) {
      throw ApiError.notFound('Job not found');
    }

    if (job.status !== JobStatus.PENDING) {
      throw ApiError.badRequest('Only pending jobs can be rejected');
    }

    job.status = JobStatus.REJECTED;
    await job.save();

    await notificationService.notifyJobModeration(
      job.employer.toString(),
      job._id.toString(),
      false,
      job.title
    );

    return job.populate(['company', 'employer']);
  }

  /** Returns aggregate platform statistics (users, jobs, applications, companies) */
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
      Employee.countDocuments(),
      Employer.countDocuments(),
      Job.countDocuments(),
      Job.countDocuments({ status: JobStatus.ACTIVE }),
      Job.countDocuments({ status: JobStatus.PENDING }),
      Application.countDocuments(),
      Company.countDocuments(),
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

export default new AdminService();
