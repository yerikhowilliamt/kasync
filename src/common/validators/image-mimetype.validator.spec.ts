import { ImageMimeTypeValidator } from './image-mimetype.validator';

describe('ImageMimeTypeValidator', () => {
  let validator: ImageMimeTypeValidator;

  beforeEach(() => {
    validator = new ImageMimeTypeValidator();
  });

  it('should return false if file is undefined', () => {
    expect(validator.isValid()).toBe(false);
  });

  it('should return true for valid JPEG with correct magic bytes', () => {
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'avatar.jpg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(true);
  });

  it('should return true for valid PNG with correct magic bytes', () => {
    const file = {
      mimetype: 'image/png',
      originalname: 'photo.png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(true);
  });

  it('should return true for valid GIF with correct magic bytes', () => {
    const file = {
      mimetype: 'image/gif',
      originalname: 'anim.gif',
      buffer: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(true);
  });

  it('should return true for valid WEBP with RIFF+WEBP signature', () => {
    const buffer = Buffer.alloc(12);
    // RIFF header
    buffer.write('RIFF', 0, 'ascii');
    // file size placeholder
    buffer.writeUInt32LE(0, 4);
    // WEBP marker
    buffer.write('WEBP', 8, 'ascii');

    const file = {
      mimetype: 'image/webp',
      originalname: 'photo.webp',
      buffer,
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(true);
  });

  it('should return false for valid mimetype but invalid extension (security bypass attempt)', () => {
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'malicious.php',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should return false for invalid mimetype but valid extension (spoofed extension attempt)', () => {
    const file = {
      mimetype: 'application/x-php',
      originalname: 'photo.jpg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should return false when magic bytes do not match declared mime type (MIME spoofing attempt)', () => {
    // Declare as JPEG but actually has PNG magic bytes
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'fake.jpg',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should return false when buffer is empty', () => {
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'empty.jpg',
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should return false when buffer is missing', () => {
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'nobuffer.jpg',
    } as unknown as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should build correct error message', () => {
    expect(validator.buildErrorMessage()).toContain('Only image files');
  });
});
