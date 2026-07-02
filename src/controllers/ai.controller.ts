import { Request, Response, NextFunction } from 'express';
import { AIService } from '../services/ai.service';
import { UserRepository } from '../repositories/user.repository';
import { JobRepository } from '../repositories/job.repository';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { IEmployee, IJob } from '../types';

export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly userRepository: UserRepository,
    private readonly jobRepository: JobRepository,
  ) {}

  async parseResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No PDF file uploaded');
      }

      const parsed = await this.aiService.parseResume(req.file.buffer);

      ApiResponse.success(res, { parsed }, 'Resume parsed successfully. Review the data before saving.');
    } catch (error) {
      next(error);
    }
  }

  async applyParsedResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { skills, experience, education, bio, headline } = req.body;

      const updateData: Record<string, unknown> = {};
      if (skills && skills.length > 0) updateData.skills = skills;
      if (experience && experience.length > 0) {
        updateData.experience = experience.map((exp: any) => ({
          ...exp,
          title: exp.title || 'Untitled Role',
          company: exp.company || 'Unknown Company',
          startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
          endDate: exp.endDate ? new Date(exp.endDate) : undefined,
          current: exp.current ?? false,
        }));
      }
      if (education && education.length > 0) {
        updateData.education = education.map((edu: any) => ({
          ...edu,
          institution: edu.institution || 'Unknown Institution',
          degree: edu.degree || 'Degree',
          fieldOfStudy: edu.fieldOfStudy || edu.degree || 'General',
          startDate: edu.startDate ? new Date(edu.startDate) : new Date(),
          endDate: edu.endDate ? new Date(edu.endDate) : undefined,
          current: edu.current ?? false,
        }));
      }
      if (bio) updateData.bio = bio;
      if (headline) updateData.headline = headline;

      const employee = await this.userRepository.updateEmployee(req.userId!, updateData);

      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }

      ApiResponse.success(res, { user: employee }, 'Profile updated with parsed resume data');
    } catch (error) {
      next(error);
    }
  }

  async generateJobDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, skills, experienceLevel, jobType, workMode, location, salaryMin, salaryMax, companyDescription } = req.body;

      const description = await this.aiService.generateJobDescription({
        title,
        skills,
        experienceLevel,
        jobType,
        workMode,
        location,
        salaryMin,
        salaryMax,
        companyDescription,
      });

      ApiResponse.success(res, { description }, 'Job description generated');
    } catch (error) {
      next(error);
    }
  }

  async generateCoverLetter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        throw ApiError.badRequest('Job ID is required');
      }

      const coverLetter = await this.aiService.generateCoverLetter(req.userId!, jobId);

      ApiResponse.success(res, { coverLetter }, 'Cover letter generated');
    } catch (error) {
      next(error);
    }
  }

  async getMatchScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;

      const [employee, job] = await Promise.all([
        this.userRepository.findEmployeeById(req.userId!),
        this.jobRepository.findById(jobId),
      ]);

      if (!employee) {
        throw ApiError.notFound('Employee profile not found');
      }

      if (!job) {
        throw ApiError.notFound('Job not found');
      }

      const matchScore = this.aiService.calculateMatchScore(employee as IEmployee, job as IJob);
      const explanation = this.aiService.generateMatchExplanation(employee as IEmployee, job as IJob, matchScore);

      ApiResponse.success(res, { ...matchScore, explanation }, 'Match score calculated');
    } catch (error) {
      next(error);
    }
  }

  async getApplicantMatchScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId, applicantId } = req.params;

      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw ApiError.notFound('Job not found');
      }

      if (job.employer.toString() !== req.userId) {
        throw ApiError.forbidden('You can only view match scores for your own jobs');
      }

      const employee = await this.userRepository.findEmployeeById(applicantId);
      if (!employee) {
        throw ApiError.notFound('Applicant not found');
      }

      const matchScore = this.aiService.calculateMatchScore(employee as IEmployee, job as IJob);

      ApiResponse.success(res, matchScore, 'Applicant match score calculated');
    } catch (error) {
      next(error);
    }
  }
}
