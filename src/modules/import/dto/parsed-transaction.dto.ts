import {
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class ParsedTransactionDto {
  @IsString()
  txnDate!: string;

  @IsDecimal()
  amount!: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  externalRef?: string;

  @IsString()
  dedupHash?: string;
}
