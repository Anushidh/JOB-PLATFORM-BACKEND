import { Request, Response, NextFunction } from 'express';
import { UploadService } from '../services/upload.service';
import { UserRepository } from '../repositories/user.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { UserRole } from '../types';

export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly userRepository: UserRepository,
    private readonly companyRepository: CompanyRepository,
  ) {}

  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      const result = await this.uploadService.uploadAvatar(req.file);

      if (req.userRole === UserRole.EMPLOYEE) {
        await this.userRepository.updateEmployee(req.userId!, { avatar: result.url });
      } else if (req.userRole === UserRole.EMPLOYER) {
        await this.userRepository.updateEmployer(req.userId!, { avatar: result.url });
      }

      ApiResponse.success(res, {
        url: result.url,
        publicId: result.publicId,
      }, 'Avatar uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadCompanyLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      const company = await this.companyRepository.findByOwner(req.userId!);
      if (!company) {
        throw ApiError.badRequest('You must create a company first');
      }

      const result = await this.uploadService.uploadLogo(req.file);

      await this.companyRepository.update(company._id.toString(), { logoUrl: result.url });

      ApiResponse.success(res, {
        url: result.url,
        publicId: result.publicId,
      }, 'Company logo uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      const result = await this.uploadService.uploadResume(req.file);

      await this.userRepository.updateEmployeeResume(req.userId!, result.url, result.publicId);

      ApiResponse.success(res, {
        url: result.url,
        publicId: result.publicId,
      }, 'Resume uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { publicId, resourceType } = req.body;
      if (!publicId) {
        throw ApiError.badRequest('Public ID is required');
      }

      await this.uploadService.deleteFile(publicId, resourceType || 'image');
      ApiResponse.success(res, null, 'File deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getResumeDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employee = await this.userRepository.findEmployeeByIdSelect(
        req.userId!,
        'resumePath resumePublicId',
      );

      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }

      const publicId = this.uploadService.resolveResumePublicId(
        employee.resumePublicId,
        employee.resumePath,
      );

      if (!publicId) {
        throw ApiError.notFound('No resume uploaded');
      }

      const signedUrl = this.uploadService.getSignedDownloadUrl(publicId, 'raw');
      ApiResponse.success(res, signedUrl, 'Signed resume URL generated');
    } catch (error) {
      next(error);
    }
  }
}
