import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ImportCsvDto {
  @ApiProperty({ description: 'Account UUID' })
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ description: 'Bank format', enum: ['BCA', 'MANDIRI'] })
  @IsString()
  @IsNotEmpty()
  bankFormat!: string;
}
