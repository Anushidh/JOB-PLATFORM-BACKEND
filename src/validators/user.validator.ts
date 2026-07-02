import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../utils/constants';

export const updateEmployeeProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    bio: z.string().max(1000).optional(),
    headline: z.string().max(200).optional(),
    location: z.string().optional(),
    expectedSalary: z.number().positive().optional(),
    skills: z.array(z.string()).optional(),
    preferredJobType: z.array(z.string()).optional(),
    preferredWorkMode: z.array(z.string()).optional(),
    portfolioLinks: z.array(z.string().url()).optional(),
    billingState: z.string().max(50).optional(),
    experience: z.array(z.object({
      title: z.string().min(1, 'Job title is required'),
      company: z.string().min(1, 'Company is required'),
      location: z.string().optional(),
      startDate: z.string().min(1, 'Start date is required'),
      endDate: z.string().optional(),
      current: z.boolean(),
      description: z.string().optional(),
    }).refine(
      (data) => {
        if (data.startDate && new Date(data.startDate) > new Date()) return false;
        return true;
      },
      { message: 'Start date cannot be in the future', path: ['startDate'] }
    ).refine(
      (data) => {
        if (!data.current && data.endDate && data.startDate) {
          return new Date(data.endDate) >= new Date(data.startDate);
        }
        return true;
      },
      { message: 'End date must be after start date', path: ['endDate'] }
    )).optional(),
    education: z.array(z.object({
      institution: z.string().min(1, 'Institution is required'),
      degree: z.string().min(1, 'Degree is required'),
      fieldOfStudy: z.string().min(1, 'Field of study is required'),
      startDate: z.string().min(1, 'Start date is required'),
      endDate: z.string().optional(),
      current: z.boolean(),
    }).refine(
      (data) => {
        if (data.startDate && new Date(data.startDate) > new Date()) return false;
        return true;
      },
      { message: 'Start date cannot be in the future', path: ['startDate'] }
    ).refine(
      (data) => {
        if (!data.current && data.endDate && data.startDate) {
          return new Date(data.endDate) >= new Date(data.startDate);
        }
        return true;
      },
      { message: 'End date must be after start date', path: ['endDate'] }
    )).optional(),
  }),
});

export const updateEmployerProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    position: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
    billingState: z.string().max(50).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `New password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH),
  }),
});

export const updateResumeSchema = z.object({
  body: z.object({
    resumePath: z.string().min(1, 'Resume path is required'),
  }),
});
