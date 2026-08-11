-- DropForeignKey
ALTER TABLE "allocations" DROP CONSTRAINT "allocations_bank_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "allocations" DROP CONSTRAINT "allocations_ledger_entry_id_fkey";

-- DropForeignKey
ALTER TABLE "bank_transactions" DROP CONSTRAINT "bank_transactions_account_id_fkey";

-- DropIndex
DROP INDEX "allocations_idempotency_key_key";

-- DropIndex
DROP INDEX "branches_name_key";

-- DropIndex
DROP INDEX "categories_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "allocations_bank_transaction_id_idempotency_key_key" ON "allocations"("bank_transaction_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "branches_user_id_name_key" ON "branches"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

