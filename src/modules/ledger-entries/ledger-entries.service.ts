import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LedgerEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLedgerEntryDto: CreateLedgerEntryDto) {
    try {
      return await this.prisma.ledgerEntry.create({
        data: {
          categoryId: createLedgerEntryDto.categoryId,
          branchId: createLedgerEntryDto.branchId,
          entryDate: new Date(createLedgerEntryDto.entryDate),
          amount: new Prisma.Decimal(createLedgerEntryDto.amount),
          type: createLedgerEntryDto.type,
          note: createLedgerEntryDto.note,
        },
        include: {
          category: true,
          branch: true,
        },
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

  async findAll() {
    return this.prisma.ledgerEntry.findMany({
      include: {
        category: true,
        branch: true,
      },
      orderBy: {
        entryDate: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id },
      include: {
        category: true,
        branch: true,
      },
    });

    if (!entry) {
      throw new NotFoundException(`Ledger entry with ID ${id} not found`);
    }

    return entry;
  }

  async update(id: string, updateLedgerEntryDto: UpdateLedgerEntryDto) {
    await this.findOne(id); // Ensure exists

    const data: Prisma.LedgerEntryUpdateInput = {};
    if (updateLedgerEntryDto.categoryId)
      data.category = { connect: { id: updateLedgerEntryDto.categoryId } };
    if (updateLedgerEntryDto.branchId)
      data.branch = { connect: { id: updateLedgerEntryDto.branchId } };
    if (updateLedgerEntryDto.entryDate)
      data.entryDate = new Date(updateLedgerEntryDto.entryDate);
    if (updateLedgerEntryDto.amount !== undefined)
      data.amount = new Prisma.Decimal(updateLedgerEntryDto.amount);
    if (updateLedgerEntryDto.type) data.type = updateLedgerEntryDto.type;
    if (updateLedgerEntryDto.note !== undefined)
      data.note = updateLedgerEntryDto.note;

    try {
      return await this.prisma.ledgerEntry.update({
        where: { id },
        data,
        include: {
          category: true,
          branch: true,
        },
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

  async remove(id: string) {
    await this.findOne(id); // Ensure exists
    return this.prisma.ledgerEntry.delete({
      where: { id },
    });
  }
}
