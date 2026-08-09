import { FileValidator, Injectable } from '@nestjs/common';

export interface ImageMimeTypeValidatorOptions {
  allowedMimeTypes?: string[];
}

@Injectable()
export class ImageMimeTypeValidator extends FileValidator<ImageMimeTypeValidatorOptions> {
  private readonly defaultAllowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  constructor(options: ImageMimeTypeValidatorOptions = {}) {
    super(options);
  }

  public isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    const allowedTypes =
      this.validationOptions.allowedMimeTypes || this.defaultAllowedTypes;

    const mimetype = file.mimetype.toLowerCase();
    const filename = file.originalname.toLowerCase();

    const hasValidMimeType = allowedTypes.some((type) =>
      mimetype.includes(type),
    );
    const hasValidExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);

    return hasValidMimeType && hasValidExtension;
  }

  public buildErrorMessage(): string {
    return 'Invalid file type. Only image files (jpg, jpeg, png, webp, gif) are allowed.';
  }
}
