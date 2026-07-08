import cloudinary from '../config/cloudinary';
import { ApiError } from '../utils/apiError';

interface UploadResult {
  url: string;
  publicId: string;
}

interface SignedDownloadResult {
  url: string;
  expiresAt: number;
}

const RESUME_URL_TTL_SECONDS = 3600;

export class UploadService {
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
   * Upload company banner
   */
  async uploadBanner(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadBuffer(file.buffer, 'banners', 'image');
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

  /**
   * Generate a short-lived signed download URL for a private Cloudinary asset.
   */
  getSignedDownloadUrl(
    publicId: string,
    resourceType: 'image' | 'raw' = 'raw',
    ttlSeconds = RESUME_URL_TTL_SECONDS,
  ): SignedDownloadResult {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      sign_url: true,
      expires_at: expiresAt,
    });

    return { url, expiresAt };
  }

  /**
   * Best-effort extraction of a Cloudinary public ID from a stored secure URL.
   */
  extractPublicIdFromUrl(url: string, resourceType: 'image' | 'raw' = 'raw'): string | null {
    const marker = `/upload/`;
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return null;

    let path = url.slice(markerIndex + marker.length);
    path = path.replace(/^v\d+\//, '');
    path = path.split('?')[0];

    if (resourceType === 'raw') {
      return path.replace(/\.[^/.]+$/, '');
    }

    return path.replace(/\.[^/.]+$/, '');
  }

  resolveResumePublicId(publicId?: string | null, resumePath?: string | null): string | null {
    if (publicId) return publicId;
    if (!resumePath) return null;
    return this.extractPublicIdFromUrl(resumePath, 'raw');
  }
}