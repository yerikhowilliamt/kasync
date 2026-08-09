import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({
    status: 201,
    description: 'The account has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @HttpCode(HttpStatus.CREATED)
  create(@ReqUser('sub') userId: string, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts' })
  @ApiResponse({ status: 200, description: 'Return all accounts.' })
  findAll(@ReqUser('sub') userId: string) {
    return this.accountsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an account by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Return the account.' })
  @ApiResponse({ status: 404, description: 'Account not found.' })
  findOne(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.accountsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiParam({ name: 'id', type: 'string', description: 'Account ID' })
  @ApiResponse({
    status: 200,
    description: 'The account has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Account not found.' })
  update(
    @ReqUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  @ApiParam({ name: 'id', type: 'string', description: 'Account ID' })
  @ApiResponse({
    status: 200,
    description: 'The account has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Account not found.' })
  remove(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.accountsService.remove(id, userId);
  }
}
