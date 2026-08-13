import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransactionType, TransactionStatus } from '@prisma/client';

export enum TransactionTypeEnum {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
}

export enum TransactionStatusEnum {
  UNRESOLVED = 'UNRESOLVED',
  PARTIALLY_RESOLVED = 'PARTIALLY_RESOLVED',
  RESOLVED = 'RESOLVED',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Account ID (UUID)' })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by Branch ID (UUID)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by Category ID (UUID)' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by Start Date (ISO-8601)' })
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by End Date (ISO-8601)' })
  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by Transaction Type',
    enum: TransactionTypeEnum,
  })
  @IsEnum(TransactionTypeEnum)
  @IsOptional()
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by Transaction Status',
    enum: TransactionStatusEnum,
  })
  @IsEnum(TransactionStatusEnum)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({
    default: 1,
    description: 'Page number for paginated list (1-based)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 50,
    description: 'Items per page for paginated list',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
