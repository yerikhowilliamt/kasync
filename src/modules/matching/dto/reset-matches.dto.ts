import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResetMatchesDto {
  @ApiPropertyOptional({ description: 'Filter reset to a specific account ID' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
