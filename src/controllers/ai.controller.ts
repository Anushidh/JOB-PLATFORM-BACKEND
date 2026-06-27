import { Request, Response, NextFunction } from 'express';
import aiService from '../services/ai.service';
import Employee from '../models/Employee';
import Job from '../models/Job';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuthRequest, IEmployee, IJob, UserRole } from '../types';

class AIController {
  /** Parses an uploaded resume PDF and returns structured profile data */
  async parseResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No PDF file uploaded');
      }

      const parsed = await aiService.parseResume(req.file.buffer);

      ApiResponse.success(res, { parsed }, 'Resume parsed successfully. Review the data before saving.');
    } catch (error) {
      next(error);
    }
  }

  /** Applies parsed resume data to the employee's profile */
  async applyParsedResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { skills, experience, education, bio, headline } = req.body;

      const updateData: any = {};
      if (skills && skills.length > 0) updateData.skills = skills;
      if (experience && experience.length > 0) updateData.experience = experience;
      if (education && education.length > 0) updateData.education = education;
      if (bio) updateData.bio = bio;
      if (headline) updateData.headline = headline;

      const employee = await Employee.findByIdAndUpdate(
        req.userId,
        { $set: updateData },
        { new: true }
      );

      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }

      ApiResponse.success(res, { user: employee }, 'Profile updated with parsed resume data');
    } catch (error) {
      next(error);
    }
  }

  /** Generates a professional job description from basic job details */
  async generateJobDescription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, skills, experienceLevel, jobType, workMode, location, salaryMin, salaryMax, companyDescription } = req.body;

      const description = await aiService.generateJobDescription({
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

  /** Generates a personalized cover letter for an employee applying to a specific job */
  async generateCoverLetter(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        throw ApiError.badRequest('Job ID is required');
      }

      const coverLetter = await aiService.generateCoverLetter(req.userId!, jobId);

      ApiResponse.success(res, { coverLetter }, 'Cover letter generated');
    } catch (error) {
      next(error);
    }
  }

  /** Returns a match score between the authenticated employee and a specific job */
  async getMatchScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;

      const [employee, job] = await Promise.all([
        Employee.findById(req.userId),
        Job.findById(jobId),
      ]);

      if (!employee) {
        throw ApiError.notFound('Employee profile not found');
      }

      if (!job) {
        throw ApiError.notFound('Job not found');
      }

      const matchScore = aiService.calculateMatchScore(employee as IEmployee, job as IJob);
      const explanation = aiService.generateMatchExplanation(employee as IEmployee, job as IJob, matchScore);

      ApiResponse.success(res, { ...matchScore, explanation }, 'Match score calculated');
    } catch (error) {
      next(error);
    }
  }

  /** Returns match scores for an employer viewing applicants for their job */
  async getApplicantMatchScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId, applicantId } = req.params;

      const job = await Job.findById(jobId);
      if (!job) {
        throw ApiError.notFound('Job not found');
      }

      if (job.employer.toString() !== req.userId) {
        throw ApiError.forbidden('You can only view match scores for your own jobs');
      }

      const employee = await Employee.findById(applicantId);
      if (!employee) {
        throw ApiError.notFound('Applicant not found');
      }

      const matchScore = aiService.calculateMatchScore(employee as IEmployee, job as IJob);

      ApiResponse.success(res, matchScore, 'Applicant match score calculated');
    } catch (error) {
      next(error);
    }
  }
}

export default new AIController();
