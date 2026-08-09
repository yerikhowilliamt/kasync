import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch, Prisma } from '@prisma/client';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(createBranchDto: CreateBranchDto): Promise<Branch> {
    return await this.prisma.branch.create({
      data: createBranchDto,
    });
  }

  async findAll(): Promise<Branch[]> {
    return await this.prisma.branch.findMany();
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  async update(id: string, updateBranchDto: UpdateBranchDto): Promise<Branch> {
    await this.findOne(id); // Check existence
    return await this.prisma.branch.update({
      where: { id },
      data: updateBranchDto,
    });
  }

  async remove(id: string): Promise<Branch> {
    await this.findOne(id); // Check existence
    try {
      return await this.prisma.branch.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete branch referenced by existing ledger entries',
        );
      }
      throw error;
    }
  }
}
