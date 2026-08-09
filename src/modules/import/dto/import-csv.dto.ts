import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';

export class ImportCsvDto {
  @ApiProperty({ description: 'Account UUID' })
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ description: 'Bank format', enum: ['BCA', 'MANDIRI'] })
  @IsIn(['BCA', 'MANDIRI'])
  @IsNotEmpty()
  bankFormat!: string;
}
