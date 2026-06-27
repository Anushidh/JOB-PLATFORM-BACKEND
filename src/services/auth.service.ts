import Employee from '../models/Employee';
import Employer from '../models/Employer';
import Admin from '../models/Admin';
import redis from '../config/redis';
import { ApiError } from '../utils/apiError';
import { IEmployee, IEmployer, IAdmin, UserRole } from '../types';
import tokenService from './token.service';
import otpService from './otp.service';
import emailService from './email.service';

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

const PENDING_REGISTRATION_EXPIRY = 600; // 10 minutes (longer than OTP to allow for delays)

class AuthService {
  /** Checks if an email is already registered as an employee or employer */
  private async isEmailTaken(email: string): Promise<boolean> {
    const [employee, employer] = await Promise.all([
      Employee.findOne({ email }),
      Employer.findOne({ email }),
    ]);
    return !!(employee || employer);
  }

  private getPendingRegistrationKey(email: string, role: UserRole): string {
    return `pending_registration:${role}:${email}`;
  }

  /** Stores employee registration data in Redis and sends a verification OTP email */
  async initiateEmployeeRegistration(data: EmployeeRegisterData): Promise<{ expiresIn: number; message: string }> {
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      throw ApiError.conflict('Email already registered');
    }

    // Store registration data in Redis
    const key = this.getPendingRegistrationKey(data.email, UserRole.EMPLOYEE);
    await redis.set(key, JSON.stringify(data), 'EX', PENDING_REGISTRATION_EXPIRY);

    // Send OTP
    const purpose = `register:${UserRole.EMPLOYEE}`;
    const { expiresIn } = await otpService.sendOtp(data.email, purpose);

    return {
      expiresIn,
      message: `OTP sent to ${data.email}. Valid for ${expiresIn / 60} minutes.`,
    };
  }

  /** Stores employer registration data in Redis and sends a verification OTP email */
  async initiateEmployerRegistration(data: EmployerRegisterData): Promise<{ expiresIn: number; message: string }> {
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      throw ApiError.conflict('Email already registered');
    }

    // Store registration data in Redis
    const key = this.getPendingRegistrationKey(data.email, UserRole.EMPLOYER);
    await redis.set(key, JSON.stringify(data), 'EX', PENDING_REGISTRATION_EXPIRY);

    // Send OTP
    const purpose = `register:${UserRole.EMPLOYER}`;
    const { expiresIn } = await otpService.sendOtp(data.email, purpose);

    return {
      expiresIn,
      message: `OTP sent to ${data.email}. Valid for ${expiresIn / 60} minutes.`,
    };
  }

  /** Verifies OTP, creates the employee account from Redis-stored data, and sends a welcome email */
  async verifyAndRegisterEmployee(email: string, otp: string): Promise<{ user: IEmployee; tokens: TokenPair }> {
    // Verify OTP
    const purpose = `register:${UserRole.EMPLOYEE}`;
    await otpService.verifyOtp(email, purpose, otp);

    // Get stored registration data from Redis
    const key = this.getPendingRegistrationKey(email, UserRole.EMPLOYEE);
    const storedData = await redis.get(key);
    if (!storedData) {
      throw ApiError.badRequest('Registration session expired. Please start over.');
    }

    const data: EmployeeRegisterData = JSON.parse(storedData);

    // Double-check email isn't taken (race condition prevention)
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      await redis.del(key);
      throw ApiError.conflict('Email already registered');
    }

    // Create employee
    const employee = await Employee.create({ ...data, isVerified: true });
    const tokens = await tokenService.generateTokenPair(
      employee._id.toString(),
      UserRole.EMPLOYEE
    );

    // Clean up Redis
    await redis.del(key);

    // Send welcome email
    await emailService.sendWelcome(data.email, data.firstName, 'employee');

    return { user: employee, tokens };
  }

  /** Verifies OTP, creates the employer account from Redis-stored data, and sends a welcome email */
  async verifyAndRegisterEmployer(email: string, otp: string): Promise<{ user: IEmployer; tokens: TokenPair }> {
    // Verify OTP
    const purpose = `register:${UserRole.EMPLOYER}`;
    await otpService.verifyOtp(email, purpose, otp);

    // Get stored registration data from Redis
    const key = this.getPendingRegistrationKey(email, UserRole.EMPLOYER);
    const storedData = await redis.get(key);
    if (!storedData) {
      throw ApiError.badRequest('Registration session expired. Please start over.');
    }

    const data: EmployerRegisterData = JSON.parse(storedData);

    // Double-check email isn't taken (race condition prevention)
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      await redis.del(key);
      throw ApiError.conflict('Email already registered');
    }

    // Create employer
    const employer = await Employer.create({ ...data, isVerified: true });
    const tokens = await tokenService.generateTokenPair(
      employer._id.toString(),
      UserRole.EMPLOYER
    );

    // Clean up Redis
    await redis.del(key);

    // Send welcome email
    await emailService.sendWelcome(data.email, data.firstName, 'employer');

    return { user: employer, tokens };
  }

  /** Authenticates an employee by email/password, checks suspension status, and returns tokens */
  async loginEmployee(data: LoginData): Promise<{ user: IEmployee; tokens: TokenPair }> {
    const employee = await Employee.findOne({ email: data.email, isDeleted: false }).select('+password');
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

    const tokens = await tokenService.generateTokenPair(
      employee._id.toString(),
      UserRole.EMPLOYEE
    );

    return { user: employee, tokens };
  }

  /** Authenticates an employer by email/password, checks suspension status, and returns tokens */
  async loginEmployer(data: LoginData): Promise<{ user: IEmployer; tokens: TokenPair }> {
    const employer = await Employer.findOne({ email: data.email, isDeleted: false }).select('+password');
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

    const tokens = await tokenService.generateTokenPair(
      employer._id.toString(),
      UserRole.EMPLOYER
    );

    return { user: employer, tokens };
  }

  /** Authenticates an admin by email/password and returns tokens */
  async loginAdmin(data: LoginData): Promise<{ user: IAdmin; tokens: TokenPair }> {
    const admin = await Admin.findOne({ email: data.email }).select('+password');
    if (!admin) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await admin.comparePassword(data.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = await tokenService.generateTokenPair(
      admin._id.toString(),
      UserRole.ADMIN
    );

    return { user: admin, tokens };
  }

  /** Validates a refresh token and rotates the token pair, returning new access/refresh tokens */
  async refreshTokens(token: string): Promise<TokenPair> {
    try {
      const decoded = await tokenService.verifyRefreshToken(token);

      let user;
      if (decoded.role === UserRole.EMPLOYEE) {
        user = await Employee.findById(decoded.userId);
      } else if (decoded.role === UserRole.EMPLOYER) {
        user = await Employer.findById(decoded.userId);
      } else if (decoded.role === UserRole.ADMIN) {
        user = await Admin.findById(decoded.userId);
      }

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      if (decoded.role !== UserRole.ADMIN) {
        const u = user as any;
        if (u.isSuspended || !u.isActive) {
          throw ApiError.forbidden('Account is not accessible');
        }
      }

      const tokens = await tokenService.rotateRefreshToken(decoded.userId, decoded.role);
      return tokens;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }

  /** Revokes the refresh token and blacklists the current access token */
  async logout(userId: string, role: UserRole, accessToken: string): Promise<void> {
    await tokenService.revokeRefreshToken(userId, role);
    await tokenService.blacklistAccessToken(accessToken);
  }

  /** Sends a password reset OTP to the user's email after validating account status */
  async sendPasswordResetOtp(email: string, role: UserRole): Promise<{ expiresIn: number; message: string }> {
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findOne({ email });
    } else if (role === UserRole.EMPLOYER) {
      user = await Employer.findOne({ email });
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
    const { expiresIn } = await otpService.sendOtp(email, purpose);

    return {
      expiresIn,
      message: `Password reset OTP sent to ${email}. Valid for ${expiresIn / 60} minutes.`,
    };
  }

  /** Verifies the reset OTP, updates the password, and revokes all existing tokens */
  async resetPassword(
    email: string,
    role: UserRole,
    otp: string,
    newPassword: string
  ): Promise<void> {
    const purpose = `reset:${role}`;
    await otpService.verifyOtp(email, purpose, otp);

    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findOne({ email }).select('+password');
    } else if (role === UserRole.EMPLOYER) {
      user = await Employer.findOne({ email }).select('+password');
    } else {
      throw ApiError.badRequest('Password reset is not available for this role');
    }

    if (!user) {
      throw ApiError.notFound('No account found with this email');
    }

    user.password = newPassword;
    await user.save();

    await tokenService.revokeAllUserTokens(user._id.toString(), role);
  }
}

export default new AuthService();
