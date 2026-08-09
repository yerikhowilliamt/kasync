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

  async create(dto: CreateAllocationDto, userId: string) {
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
        // Lock the bank_transaction row for this transaction to prevent concurrent overallocation
        await tx.$queryRaw`SELECT id FROM bank_transactions WHERE id = ${txnId} FOR UPDATE`;

        const bankTransaction = await tx.bankTransaction.findFirst({
          where: { id: txnId, account: { userId } },
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

        // Pre-resolve idempotent items so they are excluded from cap calculation
        type AllocationRecord = NonNullable<
          Awaited<ReturnType<typeof tx.allocation.findFirst>>
        >;
        const resolvedIdempotent = new Map<string, AllocationRecord>();
        for (const item of txnItems) {
          if (item.idempotencyKey) {
            const existing = await tx.allocation.findFirst({
              where: {
                idempotencyKey: item.idempotencyKey,
                bankTransaction: { account: { userId } },
              },
            });
            if (existing) {
              resolvedIdempotent.set(item.idempotencyKey, existing);
            }
          }
        }

        // Only count items that are truly new (not idempotency-resolved) toward the cap
        const newItemsSum = txnItems.reduce((sum, item) => {
          if (
            item.idempotencyKey &&
            resolvedIdempotent.has(item.idempotencyKey)
          ) {
            return sum; // already allocated — skip from cap calculation
          }
          return sum.plus(new Decimal(item.amountPortion.toString()));
        }, new Decimal(0));

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
          const ledgerEntry = await tx.ledgerEntry.findFirst({
            where: { id: item.ledgerEntryId, userId },
          });

          if (!ledgerEntry) {
            throw new NotFoundException(
              `LedgerEntry with id ${item.ledgerEntryId} not found`,
            );
          }

          // Idempotency check (already resolved above — use cached result)
          if (item.idempotencyKey) {
            const existing = resolvedIdempotent.get(item.idempotencyKey);
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

  async revoke(id: string, userId: string) {
    const allocation = await this.prisma.allocation.findFirst({
      where: { id, bankTransaction: { account: { userId } } },
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

  async findByTransaction(txnId: string, userId: string) {
    return this.prisma.allocation.findMany({
      where: {
        bankTransactionId: txnId,
        bankTransaction: { account: { userId } },
      },
      include: { ledgerEntry: true },
    });
  }

  async findByLedgerEntry(ledgerEntryId: string, userId: string) {
    return this.prisma.allocation.findMany({
      where: { ledgerEntryId, ledgerEntry: { userId } },
      include: { bankTransaction: true },
    });
  }
}
