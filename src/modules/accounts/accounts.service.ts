import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account } from '@prisma/client';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createAccountDto: CreateAccountDto,
    userId: string,
  ): Promise<Account> {
    return this.prisma.account.create({
      data: { ...createAccountDto, user: { connect: { id: userId } } },
    });
  }

  async findAll(userId: string): Promise<Account[]> {
    return this.prisma.account.findMany({ where: { userId } });
  }

  async findOne(id: string, userId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return account;
  }

  async update(
    id: string,
    updateAccountDto: UpdateAccountDto,
    userId: string,
  ): Promise<Account> {
    await this.findOne(id, userId);
    return this.prisma.account.update({
      where: { id },
      data: updateAccountDto,
    });
  }

  async remove(id: string, userId: string): Promise<Account> {
    await this.findOne(id, userId);
    return this.prisma.account.delete({ where: { id } });
  }
}
