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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary configuration is incomplete. Required environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
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
