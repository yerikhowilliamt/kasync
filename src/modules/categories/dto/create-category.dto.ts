import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  userId?: string;
}
