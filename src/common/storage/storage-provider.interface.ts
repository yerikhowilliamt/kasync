export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
}

export interface UploadResult {
  url: string;
  publicId?: string;
  format?: string;
}

export interface StorageProvider {
  uploadFile(
    file: Express.Multer.File,
    options?: UploadOptions,
  ): Promise<UploadResult>;

  uploadImage(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<UploadResult>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
