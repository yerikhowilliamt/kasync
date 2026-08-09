import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto, userId: string): Promise<Category> {
    return await this.prisma.category.create({
       data: { ...dto, user: { connect: { id: userId } } },
    });
  }

  async findAll(userId: string): Promise<Category[]> {
    return await this.prisma.category.findMany({ where: { userId } });
  }

  async findOne(id: string, userId: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, userId: string): Promise<Category> {
    await this.findOne(id, userId);
    return await this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string): Promise<Category> {
    await this.findOne(id, userId);
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Cannot delete category referenced by existing ledger entries');
      }
      throw error;
    }
  }
}
