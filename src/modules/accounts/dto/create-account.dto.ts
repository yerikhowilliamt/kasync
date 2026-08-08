import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ description: 'The name of the account' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType, description: 'The type of the account' })
  @IsEnum(AccountType)
  @IsNotEmpty()
  type: AccountType;
}
