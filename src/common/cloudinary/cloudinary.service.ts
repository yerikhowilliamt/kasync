import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from '../storage/storage-provider.interface';

@Injectable()
export class CloudinaryService implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File buffer is required');
    }

    const { folder = 'kasync/general', resourceType = 'auto' } = options;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new BadRequestException(
                `Cloudinary upload failed: ${error?.message || 'Unknown error'}`,
              ),
            );
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
          });
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'kasync/profile-photos',
  ): Promise<UploadResult> {
    return this.uploadFile(file, { folder, resourceType: 'image' });
  }
}
