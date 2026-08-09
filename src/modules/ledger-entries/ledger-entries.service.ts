import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { Prisma } from '@prisma/client';
import {
  PaginationQueryDto,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';

@Injectable()
export class LedgerEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLedgerEntryDto, userId: string) {
    // Verify Category and Branch belong to user
    const [category, branch] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: dto.categoryId, userId } }),
      this.prisma.branch.findFirst({ where: { id: dto.branchId, userId } }),
    ]);
    if (!category || !branch) {
      throw new NotFoundException('Category or Branch not found');
    }

    try {
      return await this.prisma.ledgerEntry.create({
        data: {
          user: { connect: { id: userId } },
          category: { connect: { id: dto.categoryId } },
          branch: { connect: { id: dto.branchId } },
          entryDate: new Date(dto.entryDate),
          amount: new Prisma.Decimal(dto.amount),
          type: dto.type,
          note: dto.note,
        },
        include: { category: true, branch: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Category or Branch not found');
      }
      throw error;
    }
  }

  async findAll(
    userId: string,
    paginationQuery?: PaginationQueryDto,
  ): Promise<
    PaginatedResult<
      Prisma.LedgerEntryGetPayload<{
        include: { category: true; branch: true };
      }>
    >
  > {
    const page = Math.max(1, paginationQuery?.page ?? 1);
    const limit = Math.min(100, Math.max(1, paginationQuery?.limit ?? 50));
    const skip = (page - 1) * limit;
    const where: Prisma.LedgerEntryWhereInput = { userId };

    const [data, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        skip,
        take: limit,
        include: { category: true, branch: true },
        orderBy: { [paginationQuery?.sortBy ?? 'entryDate']: 'desc' },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, userId: string) {
    const entry = await this.prisma.ledgerEntry.findFirst({
      where: { id, userId },
      include: { category: true, branch: true },
    });
    if (!entry) {
      throw new NotFoundException(`Ledger entry with ID ${id} not found`);
    }
    return entry;
  }

  async update(id: string, dto: UpdateLedgerEntryDto, userId: string) {
    await this.findOne(id, userId);

    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, userId },
      });
      if (!cat) throw new NotFoundException('Category not found');
    }
    if (dto.branchId) {
      const br = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, userId },
      });
      if (!br) throw new NotFoundException('Branch not found');
    }

    const data: Prisma.LedgerEntryUpdateInput = {};
    if (dto.categoryId) data.category = { connect: { id: dto.categoryId } };
    if (dto.branchId) data.branch = { connect: { id: dto.branchId } };
    if (dto.entryDate) data.entryDate = new Date(dto.entryDate);
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    if (dto.type) data.type = dto.type;
    if (dto.note !== undefined) data.note = dto.note;

    try {
      return await this.prisma.ledgerEntry.update({
        where: { id },
        data,
        include: { category: true, branch: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Category or Branch not found');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.ledgerEntry.delete({ where: { id } });
  }
}
