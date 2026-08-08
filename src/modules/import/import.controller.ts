import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

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
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('accountId') accountId: string,
    @Body('bankFormat') bankFormat: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }
    if (!bankFormat) {
      throw new BadRequestException('bankFormat is required');
    }

    return this.importService.importCsv(accountId, bankFormat, file.buffer);
  }
}
