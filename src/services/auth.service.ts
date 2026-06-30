import type Redis from 'ioredis';
import { ApiError } from '../utils/apiError';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { IEmployee, IEmployer, IAdmin, UserRole } from '../types';

interface EmployeeRegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  skills?: string[];
  bio?: string;
  headline?: string;
  location?: string;
}

interface EmployerRegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  position?: string;
  department?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const PENDING_REGISTRATION_EXPIRY = 600;

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly redis: Redis,
  ) {}

  private async isEmailTaken(email: string): Promise<boolean> {
    const [employee, employer] = await Promise.all([
      this.authRepository.findEmployeeByEmail(email),
      this.authRepository.findEmployerByEmail(email),
    ]);
    return !!(employee || employer);
  }

  private getPendingRegistrationKey(email: string, role: UserRole): string {
    return `pending_registration:${role}:${email}`;
  }

  async initiateEmployeeRegistration(data: EmployeeRegisterData): Promise<{ expiresIn: number; message: string }> {
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      throw ApiError.conflict('Email already registered');
    }

    const key = this.getPendingRegistrationKey(data.email, UserRole.EMPLOYEE);
    await this.redis.set(key, JSON.stringify(data), 'EX', PENDING_REGISTRATION_EXPIRY);

    const purpose = `register:${UserRole.EMPLOYEE}`;
    const { expiresIn } = await this.otpService.sendOtp(data.email, purpose);

    return {
      expiresIn,
      message: `OTP sent to ${data.email}. Valid for ${expiresIn / 60} minutes.`,
    };
  }

  async initiateEmployerRegistration(data: EmployerRegisterData): Promise<{ expiresIn: number; message: string }> {
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      throw ApiError.conflict('Email already registered');
    }

    const key = this.getPendingRegistrationKey(data.email, UserRole.EMPLOYER);
    await this.redis.set(key, JSON.stringify(data), 'EX', PENDING_REGISTRATION_EXPIRY);

    const purpose = `register:${UserRole.EMPLOYER}`;
    const { expiresIn } = await this.otpService.sendOtp(data.email, purpose);

    return {
      expiresIn,
      message: `OTP sent to ${data.email}. Valid for ${expiresIn / 60} minutes.`,
    };
  }

  async verifyAndRegisterEmployee(email: string, otp: string): Promise<{ user: IEmployee; tokens: TokenPair }> {
    const purpose = `register:${UserRole.EMPLOYEE}`;
    await this.otpService.verifyOtp(email, purpose, otp);

    const key = this.getPendingRegistrationKey(email, UserRole.EMPLOYEE);
    const storedData = await this.redis.get(key);
    if (!storedData) {
      throw ApiError.badRequest('Registration session expired. Please start over.');
    }

    const data: EmployeeRegisterData = JSON.parse(storedData);

    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      await this.redis.del(key);
      throw ApiError.conflict('Email already registered');
    }

    const employee = await this.authRepository.createEmployee({ ...data, isVerified: true });
    const tokens = await this.tokenService.generateTokenPair(
      employee._id.toString(),
      UserRole.EMPLOYEE,
    );

    await this.redis.del(key);
    await this.emailService.sendWelcome(data.email, data.firstName, 'employee');

    return { user: employee, tokens };
  }

  async verifyAndRegisterEmployer(email: string, otp: string): Promise<{ user: IEmployer; tokens: TokenPair }> {
    const purpose = `register:${UserRole.EMPLOYER}`;
    await this.otpService.verifyOtp(email, purpose, otp);

    const key = this.getPendingRegistrationKey(email, UserRole.EMPLOYER);
    const storedData = await this.redis.get(key);
    if (!storedData) {
      throw ApiError.badRequest('Registration session expired. Please start over.');
    }

    const data: EmployerRegisterData = JSON.parse(storedData);

    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      await this.redis.del(key);
      throw ApiError.conflict('Email already registered');
    }

    const employer = await this.authRepository.createEmployer({ ...data, isVerified: true });
    const tokens = await this.tokenService.generateTokenPair(
      employer._id.toString(),
      UserRole.EMPLOYER,
    );

    await this.redis.del(key);
    await this.emailService.sendWelcome(data.email, data.firstName, 'employer');

    return { user: employer, tokens };
  }

  async loginEmployee(data: LoginData): Promise<{ user: IEmployee; tokens: TokenPair }> {
    const employee = await this.authRepository.findEmployeeByEmailWithPassword(data.email);
    if (!employee) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await employee.comparePassword(data.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (employee.isSuspended) {
      throw ApiError.forbidden('Account is suspended. Contact support.');
    }

    if (!employee.isActive) {
      throw ApiError.forbidden('Account is deactivated');
    }

    const tokens = await this.tokenService.generateTokenPair(
      employee._id.toString(),
      UserRole.EMPLOYEE,
    );

    return { user: employee, tokens };
  }

  async loginEmployer(data: LoginData): Promise<{ user: IEmployer; tokens: TokenPair }> {
    const employer = await this.authRepository.findEmployerByEmailWithPassword(data.email);
    if (!employer) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await employer.comparePassword(data.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (employer.isSuspended) {
      throw ApiError.forbidden('Account is suspended. Contact support.');
    }

    if (!employer.isActive) {
      throw ApiError.forbidden('Account is deactivated');
    }

    const tokens = await this.tokenService.generateTokenPair(
      employer._id.toString(),
      UserRole.EMPLOYER,
    );

    return { user: employer, tokens };
  }

  async loginAdmin(data: LoginData): Promise<{ user: IAdmin; tokens: TokenPair }> {
    const admin = await this.authRepository.findAdminByEmailWithPassword(data.email);
    if (!admin) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await admin.comparePassword(data.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = await this.tokenService.generateTokenPair(
      admin._id.toString(),
      UserRole.ADMIN,
    );

    return { user: admin, tokens };
  }

  async refreshTokens(token: string): Promise<TokenPair> {
    try {
      const decoded = await this.tokenService.verifyRefreshToken(token);

      const user = await this.authRepository.findUserById(decoded.userId, decoded.role);

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      if (decoded.role !== UserRole.ADMIN) {
        const u = user as IEmployee | IEmployer;
        if (u.isSuspended || !u.isActive) {
          throw ApiError.forbidden('Account is not accessible');
        }
      }

      return this.tokenService.rotateRefreshToken(decoded.userId, decoded.role);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }

  async logout(userId: string, role: UserRole, accessToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(userId, role);
    await this.tokenService.blacklistAccessToken(accessToken);
  }

  async sendPasswordResetOtp(email: string, role: UserRole): Promise<{ expiresIn: number; message: string }> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.authRepository.findEmployeeByEmail(email);
    } else if (role === UserRole.EMPLOYER) {
      user = await this.authRepository.findEmployerByEmail(email);
    } else {
      throw ApiError.badRequest('Password reset is not available for this role');
    }

    if (!user) {
      throw ApiError.notFound('No account found with this email');
    }

    if (user.isSuspended) {
      throw ApiError.forbidden('Account is suspended. Contact support.');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account is deactivated');
    }

    const purpose = `reset:${role}`;
    const { expiresIn } = await this.otpService.sendOtp(email, purpose);

    return {
      expiresIn,
      message: `Password reset OTP sent to ${email}. Valid for ${expiresIn / 60} minutes.`,
    };
  }

  async resetPassword(
    email: string,
    role: UserRole,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const purpose = `reset:${role}`;
    await this.otpService.verifyOtp(email, purpose, otp);

    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await this.authRepository.findEmployeeByEmailWithPasswordReset(email);
    } else if (role === UserRole.EMPLOYER) {
      user = await this.authRepository.findEmployerByEmailWithPasswordReset(email);
    } else {
      throw ApiError.badRequest('Password reset is not available for this role');
    }

    if (!user) {
      throw ApiError.notFound('No account found with this email');
    }

    user.password = newPassword;
    await user.save();

    await this.tokenService.revokeAllUserTokens(user._id.toString(), role);
  }
}
