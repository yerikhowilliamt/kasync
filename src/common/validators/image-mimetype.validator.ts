import { FileValidator, Injectable } from '@nestjs/common';

export interface ImageMimeTypeValidatorOptions {
  allowedMimeTypes?: string[];
}

interface MagicBytesSignature {
  mime: string;
  extension: string;
  bytes: number[];
  mask?: number[];
}

const MAGIC_SIGNATURES: MagicBytesSignature[] = [
  { mime: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', extension: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', extension: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  {
    mime: 'image/webp',
    extension: 'webp',
    bytes: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    mask: undefined,
  },
];

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

    // 1. Check declared mime type
    const hasValidMimeType = allowedTypes.some((type) =>
      mimetype.includes(type),
    );

    // 2. Check file extension
    const hasValidExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);

    if (!hasValidMimeType || !hasValidExtension) {
      return false;
    }

    // 3. Verify magic bytes in file buffer
    if (!file.buffer || file.buffer.length === 0) {
      return false;
    }

    return this.verifyMagicBytes(file.buffer, mimetype);
  }

  private verifyMagicBytes(buffer: Buffer, declaredMime: string): boolean {
    // Find the signature matching the declared mime type
    const expectedSig = MAGIC_SIGNATURES.find((sig) =>
      declaredMime.includes(sig.mime),
    );

    if (!expectedSig) {
      // No known magic bytes for this mime type — allow if mime+ext matched
      return true;
    }

    // For WEBP, check "RIFF" at offset 0 and "WEBP" at offset 8
    if (expectedSig.mime === 'image/webp') {
      if (buffer.length < 12) return false;
      return (
        buffer[0] === 0x52 && // R
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x46 && // F
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
      );
    }

    // For JPEG, PNG, GIF — check leading bytes
    if (buffer.length < expectedSig.bytes.length) {
      return false;
    }

    return expectedSig.bytes.every((byte, index) => buffer[index] === byte);
  }

  public buildErrorMessage(): string {
    return 'Invalid file type. Only image files (jpg, jpeg, png, webp, gif) are allowed.';
  }
}
