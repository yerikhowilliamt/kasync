import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

export default async () => {
  console.log('Starting E2E test setup: cleaning database...');
  try {
    // Order is important due to foreign key constraints
    await prisma.allocation.deleteMany({});
    await prisma.bankTransaction.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('Database cleaned. Applying migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    console.log('Applying raw SQL migrations...');
    execSync('npx prisma db execute --file ./docs/database/migration.sql', { stdio: 'inherit' });

    console.log('E2E test setup complete.');
  } catch (error) {
    console.error('Failed to setup E2E test database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};
