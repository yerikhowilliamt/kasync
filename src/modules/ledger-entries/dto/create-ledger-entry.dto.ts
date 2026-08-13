import {
  IsDateString,
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

export enum TransactionTypeEnum {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
}

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
  @IsDateString()
  @IsNotEmpty()
  entryDate!: string;

  @ApiProperty({ description: 'Amount', type: 'number' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'Transaction Type', enum: TransactionTypeEnum })
  @IsEnum(TransactionTypeEnum)
  @IsNotEmpty()
  type!: TransactionType;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsString()
  @IsOptional()
  note?: string;
}
