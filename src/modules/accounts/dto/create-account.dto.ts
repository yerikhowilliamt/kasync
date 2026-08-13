import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AccountType } from '@prisma/client';

export enum AccountTypeEnum {
  BANK = 'BANK',
  CASH = 'CASH',
  EWALLET = 'EWALLET',
}

export class CreateAccountDto {
  @ApiProperty({ description: 'The name of the account' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'The type of the account', enum: AccountTypeEnum })
  @IsEnum(AccountTypeEnum)
  @IsNotEmpty()
  type!: AccountType;
}
