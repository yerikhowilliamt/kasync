import { IsUUID, IsNumberString, IsOptional, ValidateNested, IsArray, IsPositive, IsNumber, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSingleAllocationDto {
  @IsUUID()
  bankTransactionId!: string;

  @IsUUID()
  ledgerEntryId!: string;

  @ValidateIf((o) => typeof o.amountPortion === 'number')
  @IsNumber()
  @IsPositive()
  @ValidateIf((o) => typeof o.amountPortion === 'string')
  @IsNumberString()
  amountPortion!: number | string;
}

export class CreateAllocationDto {
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @IsOptional()
  @IsUUID()
  ledgerEntryId?: string;

  @ValidateIf((o) => !o.allocations && typeof o.amountPortion === 'number')
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @ValidateIf((o) => !o.allocations && typeof o.amountPortion === 'string')
  @IsOptional()
  @IsNumberString()
  amountPortion?: number | string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSingleAllocationDto)
  allocations?: CreateSingleAllocationDto[];
}
