import { IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
    maxLength: 128,
  })
  @IsString()
  @MaxLength(128)
  oldPassword!: string;

  @ApiProperty({
    description: 'New password (min 8 characters, one uppercase or one digit)',
    example: 'NewPassword123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/(?=.*[A-Z])|(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter or one digit',
  })
  newPassword!: string;
}
