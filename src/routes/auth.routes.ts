import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter, otpLimiter, sensitiveLimiter } from '../middleware/rateLimiter';
import {
  initiateEmployeeRegistrationSchema,
  initiateEmployerRegistrationSchema,
  verifyRegistrationSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// Step 1: Submit registration data → stored in Redis, OTP sent
router.post('/employee/register', otpLimiter, validate(initiateEmployeeRegistrationSchema), authController.initiateEmployeeRegistration);
router.post('/employer/register', otpLimiter, validate(initiateEmployerRegistrationSchema), authController.initiateEmployerRegistration);

// Step 2: Verify OTP → user created from Redis data
router.post('/employee/verify-otp', authLimiter, validate(verifyRegistrationSchema), authController.verifyEmployeeRegistration);
router.post('/employer/verify-otp', authLimiter, validate(verifyRegistrationSchema), authController.verifyEmployerRegistration);

// Login
router.post('/employee/login', authLimiter, validate(loginSchema), authController.loginEmployee);
router.post('/employer/login', authLimiter, validate(loginSchema), authController.loginEmployer);
router.post('/admin/login', authLimiter, validate(loginSchema), authController.loginAdmin);

// Password Reset
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), authController.sendPasswordResetOtp);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Token & Session
router.post('/refresh-token', sensitiveLimiter, validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout as any);
router.get('/me', authenticate, authController.me as any);

export default router;
