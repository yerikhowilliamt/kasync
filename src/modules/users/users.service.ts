import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../common/storage/storage-provider.interface';
import type { StorageProvider } from '../../common/storage/storage-provider.interface';
import { UpdatePasswordDto } from './dto/update-password.dto';

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl,
    };
  }

  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password updated successfully' };
  }

  async updatePhotoProfile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserProfileResponse> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const uploadResult = await this.storageProvider.uploadImage(
      file,
      'profile_photos',
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl: uploadResult.url },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      photoUrl: updatedUser.photoUrl,
    };
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Account deleted successfully' };
  }
}
