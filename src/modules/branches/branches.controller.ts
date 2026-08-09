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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create branch' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@ReqUser('sub') userId: string, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all branches' })
  findAll(@ReqUser('sub') userId: string) {
    return this.branchesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by id' })
  findOne(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.branchesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update branch' })
  update(
    @ReqUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete branch' })
  remove(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.branchesService.remove(id, userId);
  }
}
