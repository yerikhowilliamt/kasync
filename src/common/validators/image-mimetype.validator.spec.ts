import { ImageMimeTypeValidator } from './image-mimetype.validator';

describe('ImageMimeTypeValidator', () => {
  let validator: ImageMimeTypeValidator;

  beforeEach(() => {
    validator = new ImageMimeTypeValidator();
  });

  it('should return false if file is undefined', () => {
    expect(validator.isValid()).toBe(false);
  });

  it('should return true for valid image mimetype and valid extension', () => {
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'avatar.jpg',
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(true);
  });

  it('should return false for valid mimetype but invalid extension (security bypass attempt)', () => {
    const file = {
      mimetype: 'image/jpeg',
      originalname: 'malicious.php',
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should return false for invalid mimetype but valid extension (spoofed extension attempt)', () => {
    const file = {
      mimetype: 'application/x-php',
      originalname: 'photo.jpg',
    } as Express.Multer.File;

    expect(validator.isValid(file)).toBe(false);
  });

  it('should build correct error message', () => {
    expect(validator.buildErrorMessage()).toContain('Only image files');
  });
});
