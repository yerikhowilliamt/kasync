import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateAllocationDto,
  CreateSingleAllocationDto,
} from './dto/create-allocation.dto';
import { AllocationExceededError } from '../../common/errors/allocation-exceeded.error';
import { AllocationStatus } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class AllocationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAllocationDto) {
    let items: CreateSingleAllocationDto[] = [];
    if (dto.allocations && dto.allocations.length > 0) {
      items = dto.allocations;
    } else if (
      dto.bankTransactionId &&
      dto.ledgerEntryId &&
      dto.amountPortion
    ) {
      items = [
        {
          bankTransactionId: dto.bankTransactionId,
          ledgerEntryId: dto.ledgerEntryId,
          amountPortion: dto.amountPortion,
        },
      ];
      if (dto.idempotencyKey) {
        items[0].idempotencyKey = dto.idempotencyKey;
      }
    }

    if (items.length === 0) {
      throw new BadRequestException('No allocations provided');
    }

    const groupedItems = items.reduce(
      (acc, item) => {
        if (!acc[item.bankTransactionId]) {
          acc[item.bankTransactionId] = [];
        }
        acc[item.bankTransactionId].push(item);
        return acc;
      },
      {} as Record<string, CreateSingleAllocationDto[]>,
    );

    return this.prisma.$transaction(async (tx) => {
      const createdAllocations = [];

      for (const [txnId, txnItems] of Object.entries(groupedItems)) {
        const bankTransaction = await tx.bankTransaction.findUnique({
          where: { id: txnId },
          include: {
            allocations: true,
          },
        });

        if (!bankTransaction) {
          throw new NotFoundException(
            `BankTransaction with id ${txnId} not found`,
          );
        }

        const existingSum = bankTransaction.allocations.reduce(
          (sum, alloc) =>
            alloc.status === AllocationStatus.ACTIVE
              ? sum.plus(new Decimal(alloc.amountPortion.toString()))
              : sum,
          new Decimal(0),
        );

        const newItemsSum = txnItems.reduce(
          (sum, item) => sum.plus(new Decimal(item.amountPortion.toString())),
          new Decimal(0),
        );

        const totalSum = existingSum.plus(newItemsSum);
        const txnAmount = new Decimal(bankTransaction.amount.toString());

        if (totalSum.gt(txnAmount)) {
          throw new AllocationExceededError({
            message: `Total allocation (${totalSum.toString()}) exceeds transaction amount (${txnAmount.toString()}) for transaction ${txnId}`,
            txnId,
            attempted: totalSum.toString(),
            max: txnAmount.toString(),
          });
        }

        for (const item of txnItems) {
          const ledgerEntry = await tx.ledgerEntry.findUnique({
            where: { id: item.ledgerEntryId },
          });

          if (!ledgerEntry) {
            throw new NotFoundException(
              `LedgerEntry with id ${item.ledgerEntryId} not found`,
            );
          }

          // Idempotency check
          if (item.idempotencyKey) {
            const existing = await tx.allocation.findUnique({
              where: { idempotencyKey: item.idempotencyKey },
            });
            if (existing) {
              createdAllocations.push(existing);
              continue;
            }
          }

          const allocation = await tx.allocation.create({
            data: {
              bankTransactionId: item.bankTransactionId,
              ledgerEntryId: item.ledgerEntryId,
              amountPortion: item.amountPortion.toString(),
              idempotencyKey: item.idempotencyKey,
              status: AllocationStatus.ACTIVE,
            },
          });
          createdAllocations.push(allocation);
        }
      }

      return createdAllocations;
    });
  }

  async revoke(id: string) {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
    });

    if (!allocation) {
      throw new NotFoundException(`Allocation with id ${id} not found`);
    }

    return this.prisma.allocation.update({
      where: { id },
      data: {
        status: AllocationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  async findByTransaction(txnId: string) {
    return this.prisma.allocation.findMany({
      where: { bankTransactionId: txnId },
      include: { ledgerEntry: true },
    });
  }

  async findByLedgerEntry(ledgerEntryId: string) {
    return this.prisma.allocation.findMany({
      where: { ledgerEntryId },
      include: { bankTransaction: true },
    });
  }
}
