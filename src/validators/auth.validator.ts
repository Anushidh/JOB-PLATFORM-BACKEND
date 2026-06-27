import { z } from 'zod';
import { UserRole } from '../types';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, NAME_MIN_LENGTH, NAME_MAX_LENGTH } from '../utils/constants';

// Reusable field schemas
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
const nameSchema = (field: string) =>
  z.string()
    .min(NAME_MIN_LENGTH, `${field} must be at least ${NAME_MIN_LENGTH} characters`)
    .max(NAME_MAX_LENGTH, `${field} must be at most ${NAME_MAX_LENGTH} characters`);
const otpSchema = z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric');
const roleSchema = z.enum([UserRole.EMPLOYER, UserRole.EMPLOYEE], {
  errorMap: () => ({ message: 'Role must be employer or employee' }),
});

// Step 1: Initiate registration (sends all data + triggers OTP)
export const initiateEmployeeRegistrationSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema('First name'),
    lastName: nameSchema('Last name'),
    phone: z.string().optional(),
    skills: z.array(z.string()).optional(),
    bio: z.string().max(1000).optional(),
    headline: z.string().max(200).optional(),
    location: z.string().optional(),
  }),
});

export const initiateEmployerRegistrationSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema('First name'),
    lastName: nameSchema('Last name'),
    phone: z.string().optional(),
    position: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
  }),
});

// Step 2: Verify OTP (only email + otp needed, data is in Redis)
export const verifyRegistrationSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    role: roleSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    role: roleSchema,
    otp: otpSchema,
    newPassword: passwordSchema,
  }),
});
