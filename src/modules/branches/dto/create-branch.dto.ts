import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ description: 'Branch name' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
