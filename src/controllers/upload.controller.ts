import { Response, NextFunction } from 'express';
import uploadService from '../services/upload.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuthRequest, UserRole } from '../types';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import Company from '../models/Company';

class UploadController {
  async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      const result = await uploadService.uploadAvatar(req.file);

      // Update user avatar in DB
      if (req.userRole === UserRole.EMPLOYEE) {
        await Employee.findByIdAndUpdate(req.userId, { avatar: result.url });
      } else if (req.userRole === UserRole.EMPLOYER) {
        await Employer.findByIdAndUpdate(req.userId, { avatar: result.url });
      }

      ApiResponse.success(res, {
        url: result.url,
        publicId: result.publicId,
      }, 'Avatar uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadCompanyLogo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      // Verify employer has a company
      const company = await Company.findOne({ owner: req.userId });
      if (!company) {
        throw ApiError.badRequest('You must create a company first');
      }

      const result = await uploadService.uploadLogo(req.file);

      // Update company logo
      await Company.findByIdAndUpdate(company._id, { logoUrl: result.url });

      ApiResponse.success(res, {
        url: result.url,
        publicId: result.publicId,
      }, 'Company logo uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      const result = await uploadService.uploadResume(req.file);

      // Update employee resume path
      await Employee.findByIdAndUpdate(req.userId, { resumePath: result.url });

      ApiResponse.success(res, {
        url: result.url,
        publicId: result.publicId,
      }, 'Resume uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { publicId, resourceType } = req.body;
      if (!publicId) {
        throw ApiError.badRequest('Public ID is required');
      }

      await uploadService.deleteFile(publicId, resourceType || 'image');
      ApiResponse.success(res, null, 'File deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new UploadController();
