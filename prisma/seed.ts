import { PrismaClient, AccountType, TransactionType, TransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding synthetic demo dataset...');

  // Create a default user first
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Admin Demo',
        email: 'admin@demo.com',
        passwordHash: 'hashed_pass_placeholder',
      }
    });
  }

  // 1. Clean existing database
  await prisma.allocation.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.branch.deleteMany();

  // 2. Create Accounts
  const bcaAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'BCA Utama (Synthetic)',
      type: AccountType.BANK,
    },
  });

  const mandiriAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Mandiri Operasional (Synthetic)',
      type: AccountType.BANK,
    },
  });

  const cashAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Petty Cash Jakarta (Synthetic)',
      type: AccountType.CASH,
    },
  });

  // 3. Create Categories
  const rawMaterialsCat = await prisma.category.create({ data: { userId: user.id, name: 'Bahan Baku & Inventory' } });
  const fuelCat = await prisma.category.create({ data: { userId: user.id, name: 'Bahan Bakar & Transport' } });
  const utilitiesCat = await prisma.category.create({ data: { userId: user.id, name: 'Listrik & Utilitas' } });
  const salesCat = await prisma.category.create({ data: { userId: user.id, name: 'Penjualan Omset' } });

  // 4. Create Branches
  const branchJakarta = await prisma.branch.create({ data: { userId: user.id, name: 'Cabang Jakarta Selatan' } });
  const branchBandung = await prisma.branch.create({ data: { userId: user.id, name: 'Cabang Bandung Central' } });
  const branchSurabaya = await prisma.branch.create({ data: { userId: user.id, name: 'Cabang Surabaya Barat' } });

  // 5. Create Ledger Entries (Manual Business Records)
  const ledger1 = await prisma.ledgerEntry.create({
    data: {
       user: { connect: { id: user.id } },
       category: { connect: { id: rawMaterialsCat.id } },
       branch: { connect: { id: branchJakarta.id } },
       entryDate: new Date('2026-08-01T08:00:00Z'),
       amount: 1500000.0,
       type: TransactionType.OUTFLOW,
       note: 'Pembelian Tepung Terigu & Gula (Supplier A)',
    },
  });

  const ledger2 = await prisma.ledgerEntry.create({
    data: {
       user: { connect: { id: user.id } },
       category: { connect: { id: fuelCat.id } },
       branch: { connect: { id: branchBandung.id } },
       entryDate: new Date('2026-08-01T09:30:00Z'),
       amount: 500000.0,
       type: TransactionType.OUTFLOW,
       note: 'BBM Armada Pengiriman Bandung',
    },
  });

  const ledger3 = await prisma.ledgerEntry.create({
    data: {
       user: { connect: { id: user.id } },
       category: { connect: { id: salesCat.id } },
       branch: { connect: { id: branchJakarta.id } },
       entryDate: new Date('2026-08-02T16:00:00Z'),
       amount: 4500000.0,
       type: TransactionType.INFLOW,
       note: 'Settlement EDCC/QRS Omset Harian',
    },
  });

  const ledger4 = await prisma.ledgerEntry.create({
    data: {
       user: { connect: { id: user.id } },
       category: { connect: { id: utilitiesCat.id } },
       branch: { connect: { id: branchSurabaya.id } },
       entryDate: new Date('2026-08-03T10:00:00Z'),
       amount: 750000.0,
       type: TransactionType.OUTFLOW,
       note: 'Tagihan Listrik PLN Agustus',
    },
  });

  // 6. Create Bank Transactions (Imported Statements)
  // Txn 1: Single full match transaction (1:1 with ledger1)
  const bankTxn1 = await prisma.bankTransaction.create({
    data: {
      accountId: bcaAccount.id,
      txnDate: new Date('2026-08-01T10:15:00Z'),
      amount: 1500000.0,
      type: TransactionType.OUTFLOW,
      description: 'TRSF E-BANKING SUPPLIER A TEPUNG',
      externalRef: 'BCA-20260801-001',
      dedupHash: 'hash-bca-001',
      status: TransactionStatus.MATCHED,
    },
  });

  // Allocation for Txn 1
  await prisma.allocation.create({
    data: {
      bankTransactionId: bankTxn1.id,
      ledgerEntryId: ledger1.id,
      amountPortion: 1500000.0,
    },
  });

  // Txn 2: Split multi-purpose transfer transaction
  const bankTxn2 = await prisma.bankTransaction.create({
    data: {
      accountId: mandiriAccount.id,
      txnDate: new Date('2026-08-01T11:00:00Z'),
      amount: 1250000.0,
      type: TransactionType.OUTFLOW,
      description: 'TRANSFER COMBINED EXPENSE FUEL AND UTILITIES',
      externalRef: 'MDR-20260801-002',
      dedupHash: 'hash-mdr-002',
      status: TransactionStatus.PARTIALLY_ALLOCATED,
    },
  });

  // Partial Allocation for Txn 2 (500,000 allocated to ledger2 fuel)
  await prisma.allocation.create({
    data: {
      bankTransactionId: bankTxn2.id,
      ledgerEntryId: ledger2.id,
      amountPortion: 500000.0,
    },
  });

  // Txn 3: Pending review transaction (Matching proposed against ledger3)
  await prisma.bankTransaction.create({
    data: {
      accountId: bcaAccount.id,
      txnDate: new Date('2026-08-02T17:00:00Z'),
      amount: 4500000.0,
      type: TransactionType.INFLOW,
      description: 'SETTLEMENT QRIS JAKARTA SELATAN',
      externalRef: 'BCA-20260802-003',
      dedupHash: 'hash-bca-003',
      status: TransactionStatus.PENDING_REVIEW,
    },
  });

  // Txn 4: Unresolved transaction (No ledger match yet)
  await prisma.bankTransaction.create({
    data: {
      accountId: cashAccount.id,
      txnDate: new Date('2026-08-03T12:00:00Z'),
      amount: 300000.0,
      type: TransactionType.OUTFLOW,
      description: 'PARKIR DAN BIAYA ADMIN TANPA NOTA',
      externalRef: 'CSH-20260803-004',
      dedupHash: 'hash-csh-004',
      status: TransactionStatus.UNRESOLVED,
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
