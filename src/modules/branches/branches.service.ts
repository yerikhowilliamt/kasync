import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch, Prisma } from '@prisma/client';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBranchDto, userId: string): Promise<Branch> {
    return await this.prisma.branch.create({
       data: { ...dto, user: { connect: { id: userId } } },
    });
  }

  async findAll(userId: string): Promise<Branch[]> {
    return await this.prisma.branch.findMany({ where: { userId } });
  }

  async findOne(id: string, userId: string): Promise<Branch> {
    const branch = await this.prisma.branch.findFirst({ where: { id, userId } });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, userId: string): Promise<Branch> {
    await this.findOne(id, userId);
    return await this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string): Promise<Branch> {
    await this.findOne(id, userId);
    try {
      return await this.prisma.branch.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Cannot delete branch referenced by existing ledger entries');
      }
      throw error;
    }
  }
}
