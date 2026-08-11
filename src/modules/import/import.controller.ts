import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ImportCsvDto } from './dto/import-csv.dto';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { ImportCsvResponseDto } from './dto/import-csv-response.dto';

@ApiTags('import')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('csv')
  @ApiOperation({ summary: 'Import bank statement CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account UUID' },
        bankFormat: {
          type: 'string',
          enum: ['BCA', 'MANDIRI'],
          description: 'Bank format',
        },
        file: { type: 'string', format: 'binary', description: 'CSV file' },
      },
    },
  })
  @ApiOkResponse({
    description: 'CSV import result with detailed error reporting.',
    type: ImportCsvResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async importCsv(
    @ReqUser('sub') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: ImportCsvDto,
  ): Promise<ImportCsvResponseDto> {
    return this.importService.importCsv(
      dto.accountId,
      dto.bankFormat,
      file.buffer,
      userId,
    );
  }
}
