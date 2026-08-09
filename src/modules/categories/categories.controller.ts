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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@ReqUser('sub') userId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all categories' })
  findAll(@ReqUser('sub') userId: string) {
    return this.categoriesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by id' })
  findOne(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category' })
  update(
    @ReqUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category' })
  remove(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.categoriesService.remove(id, userId);
  }
}
