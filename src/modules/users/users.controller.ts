import {
  Controller,
  Patch,
  Post,
  Delete,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { ImageMimeTypeValidator } from '../../common/validators/image-mimetype.validator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async updatePassword(
    @ReqUser('sub') userId: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(userId, dto);
  }

  @Post('me/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Update user profile photo via Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Photo profile updated' })
  async updatePhotoProfile(
    @ReqUser('sub') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new ImageMimeTypeValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.updatePhotoProfile(userId, file);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteAccount(
    @ReqUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.usersService.deleteAccount(userId);
    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);
    return result;
  }
}
