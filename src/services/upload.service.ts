import cloudinary from '../config/cloudinary';
import { ApiError } from '../utils/apiError';

interface UploadResult {
  url: string;
  publicId: string;
}

class UploadService {
  /**
   * Upload a buffer to Cloudinary
   */
  private async uploadBuffer(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'raw' = 'image'
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `job-platform/${folder}`,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error || !result) {
            reject(ApiError.internal('File upload failed'));
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        }
      );
      uploadStream.end(buffer);
    });
  }

  /**
   * Upload avatar image
   */
  async uploadAvatar(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadBuffer(file.buffer, 'avatars', 'image');
  }

  /**
   * Upload company logo
   */
  async uploadLogo(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadBuffer(file.buffer, 'logos', 'image');
  }

  /**
   * Upload resume (PDF/DOC)
   */
  async uploadResume(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadBuffer(file.buffer, 'resumes', 'raw');
  }

  /**
   * Delete a file from Cloudinary by public ID
   */
  async deleteFile(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      console.error('Failed to delete file from Cloudinary:', error);
    }
  }
}

export default new UploadService();
