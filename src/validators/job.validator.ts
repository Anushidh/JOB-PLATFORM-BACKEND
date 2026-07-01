import { z } from 'zod';
import { JobType, WorkMode, ExperienceLevel, JobStatus } from '../types';

export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().min(20, 'Description must be at least 20 characters'),
    salaryMin: z.number().positive('Salary must be greater than 0').optional(),
    salaryMax: z.number().positive('Salary must be greater than 0').optional(),
    salaryCurrency: z.string().optional(),
    location: z.string().min(1, 'Location is required'),
    jobType: z.nativeEnum(JobType),
    workMode: z.nativeEnum(WorkMode),
    experienceLevel: z.nativeEnum(ExperienceLevel),
    skillsRequired: z.array(z.string()).min(1, 'At least one skill is required'),
    applicationDeadline: z.string().datetime().optional(),
  }).refine(
    (data) => {
      if (data.salaryMin && data.salaryMax) {
        return data.salaryMin <= data.salaryMax;
      }
      return true;
    },
    { message: 'Minimum salary cannot exceed maximum salary', path: ['salaryMin'] }
  ).refine(
    (data) => {
      if (data.applicationDeadline) {
        return new Date(data.applicationDeadline) > new Date();
      }
      return true;
    },
    { message: 'Application deadline must be a future date', path: ['applicationDeadline'] }
  ),
});

export const updateJobSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(20).optional(),
    salaryMin: z.number().positive().optional(),
    salaryMax: z.number().positive().optional(),
    salaryCurrency: z.string().optional(),
    location: z.string().min(1).optional(),
    jobType: z.nativeEnum(JobType).optional(),
    workMode: z.nativeEnum(WorkMode).optional(),
    experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
    skillsRequired: z.array(z.string()).optional(),
    applicationDeadline: z.string().datetime().optional(),
  }),
  params: z.object({
    jobId: z.string().min(1),
  }),
});

export const changeJobStatusSchema = z.object({
  body: z.object({
    status: z.enum([JobStatus.DRAFT, JobStatus.ACTIVE, JobStatus.CLOSED]),
  }),
  params: z.object({
    jobId: z.string().min(1),
  }),
});
