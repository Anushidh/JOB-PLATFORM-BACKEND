import { z } from 'zod';

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Company name must be at least 2 characters').max(200),
    description: z.string().max(5000).optional(),
    logoUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    location: z.string().optional(),
    foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  }),
});

export const updateCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).optional(),
    logoUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    location: z.string().optional(),
    foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  }),
  params: z.object({
    companyId: z.string().min(1),
  }),
});
