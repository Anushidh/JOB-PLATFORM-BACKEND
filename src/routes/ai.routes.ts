import { Router } from 'express';
import { z } from 'zod';
import aiController from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { UserRole } from '../types';
import multer from 'multer';

const router = Router();

// Multer for resume PDF upload (memory storage, max 5MB)
const uploadResumePdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
}).single('resume');

// Validation schemas
const generateJobDescriptionSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title is required'),
    skills: z.array(z.string()).min(1, 'At least one skill is required'),
    experienceLevel: z.string().min(1),
    jobType: z.string().min(1),
    workMode: z.string().min(1),
    location: z.string().min(1),
    salaryMin: z.number().positive().optional(),
    salaryMax: z.number().positive().optional(),
    companyDescription: z.string().max(500).optional(),
  }),
});

const generateCoverLetterSchema = z.object({
  body: z.object({
    jobId: z.string().min(1, 'Job ID is required'),
  }),
});

// All AI routes require authentication
router.use(authenticate);

// --- Employee AI features ---

// Parse resume from PDF upload
router.post(
  '/parse-resume',
  roleGuard(UserRole.EMPLOYEE),
  uploadResumePdf,
  aiController.parseResume as any
);

// Apply parsed resume data to profile
router.post(
  '/apply-parsed-resume',
  roleGuard(UserRole.EMPLOYEE),
  aiController.applyParsedResume as any
);

// Generate cover letter for a job
router.post(
  '/generate-cover-letter',
  roleGuard(UserRole.EMPLOYEE),
  validate(generateCoverLetterSchema),
  aiController.generateCoverLetter as any
);

// Get match score for a job
router.get(
  '/match-score/:jobId',
  roleGuard(UserRole.EMPLOYEE),
  aiController.getMatchScore as any
);

// --- Employer AI features ---

// Generate job description
router.post(
  '/generate-job-description',
  roleGuard(UserRole.EMPLOYER),
  validate(generateJobDescriptionSchema),
  aiController.generateJobDescription as any
);

// Get applicant match score
router.get(
  '/applicant-match/:jobId/:applicantId',
  roleGuard(UserRole.EMPLOYER),
  aiController.getApplicantMatchScore as any
);

export default router;
