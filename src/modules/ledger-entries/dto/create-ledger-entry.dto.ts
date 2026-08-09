
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransactionType } from '@prisma/client';

export class CreateLedgerEntryDto {
  @ApiProperty({ description: 'Category ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ description: 'Branch ID (UUID)' })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty({ description: 'Entry Date (ISO-8601)' })
  @IsString()
  @IsNotEmpty()
  entryDate!: string;

  @ApiProperty({ description: 'Amount', type: 'number' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'Transaction Type', enum: TransactionType })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type!: TransactionType;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}

