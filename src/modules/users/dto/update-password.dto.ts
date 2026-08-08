import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'OldPassword123!' })
  @IsString()
  oldPassword!: string;

  @ApiProperty({
    description: 'New password (min 8 characters)',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword!: string;
}
