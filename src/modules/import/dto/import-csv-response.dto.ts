import { ApiProperty } from '@nestjs/swagger';

class ImportError {
  @ApiProperty()
  lineNumber!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty({ required: false })
  rowData?: string;
}

export class ImportCsvResponseDto {
  @ApiProperty()
  totalParsed!: number;

  @ApiProperty()
  importedCount!: number;

  @ApiProperty()
  duplicateCount!: number;

  @ApiProperty()
  failedCount!: number;

  @ApiProperty({ type: [ImportError] })
  errors!: ImportError[];
}
