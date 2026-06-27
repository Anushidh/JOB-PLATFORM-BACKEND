import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest, UserRole } from '../types';

class AuthController {
  // Step 1: Receive registration data, store in Redis, send OTP
  async initiateEmployeeRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone, skills, bio, headline, location } = req.body;
      const result = await authService.initiateEmployeeRegistration({
        email, password, firstName, lastName, phone, skills, bio, headline, location,
      });

      ApiResponse.success(res, {
        email,
        expiresIn: result.expiresIn,
      }, result.message);
    } catch (error) {
      next(error);
    }
  }

  async initiateEmployerRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone, position, department } = req.body;
      const result = await authService.initiateEmployerRegistration({
        email, password, firstName, lastName, phone, position, department,
      });

      ApiResponse.success(res, {
        email,
        expiresIn: result.expiresIn,
      }, result.message);
    } catch (error) {
      next(error);
    }
  }

  // Step 2: Verify OTP, pull data from Redis, create user
  async verifyEmployeeRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyAndRegisterEmployee(email, otp);

      ApiResponse.created(res, {
        user: result.user,
        tokens: result.tokens,
        role: UserRole.EMPLOYEE,
      }, 'Employee registration successful');
    } catch (error) {
      next(error);
    }
  }

  async verifyEmployerRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyAndRegisterEmployer(email, otp);

      ApiResponse.created(res, {
        user: result.user,
        tokens: result.tokens,
        role: UserRole.EMPLOYER,
      }, 'Employer registration successful');
    } catch (error) {
      next(error);
    }
  }

  async loginEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.loginEmployee({ email, password });

      ApiResponse.success(res, {
        user: result.user,
        tokens: result.tokens,
        role: UserRole.EMPLOYEE,
      }, 'Employee login successful');
    } catch (error) {
      next(error);
    }
  }

  async loginEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.loginEmployer({ email, password });

      ApiResponse.success(res, {
        user: result.user,
        tokens: result.tokens,
        role: UserRole.EMPLOYER,
      }, 'Employer login successful');
    } catch (error) {
      next(error);
    }
  }

  async loginAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.loginAdmin({ email, password });

      ApiResponse.success(res, {
        user: result.user,
        tokens: result.tokens,
        role: UserRole.ADMIN,
      }, 'Admin login successful');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshTokens(refreshToken);

      ApiResponse.success(res, { tokens }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.headers.authorization!.split(' ')[1];
      await authService.logout(req.userId!, req.userRole!, token);
      ApiResponse.success(res, null, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      ApiResponse.success(res, {
        user: req.user,
        role: req.userRole,
      }, 'User details retrieved');
    } catch (error) {
      next(error);
    }
  }

  // Password Reset
  async sendPasswordResetOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role } = req.body;
      const result = await authService.sendPasswordResetOtp(email, role);

      ApiResponse.success(res, {
        email,
        role,
        expiresIn: result.expiresIn,
      }, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role, otp, newPassword } = req.body;
      await authService.resetPassword(email, role, otp, newPassword);

      ApiResponse.success(res, null, 'Password reset successful. Please login with your new password.');
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
