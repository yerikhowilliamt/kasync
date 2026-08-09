-- AlterTable
ALTER TABLE "users" ADD COLUMN "token_valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "user_id" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "user_id" TEXT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN "user_id" TEXT;

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN "user_id" TEXT;

-- Create default system user if needed and assign existing records
DO $$
DECLARE
    default_user_id TEXT;
BEGIN
    SELECT id INTO default_user_id FROM "users" LIMIT 1;
    IF default_user_id IS NULL THEN
        default_user_id := '00000000-0000-0000-0000-000000000000';
        INSERT INTO "users" ("id", "email", "name", "password_hash", "created_at", "updated_at")
        VALUES (default_user_id, 'system@kasync.local', 'System User', '$2b$10$e7Z.42cO4M814pL16L6yye43P9Wj9c8N1Y.S5Z0lZ00Z00Z00Z00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;

    UPDATE "accounts" SET "user_id" = default_user_id WHERE "user_id" IS NULL;
    UPDATE "categories" SET "user_id" = default_user_id WHERE "user_id" IS NULL;
    UPDATE "branches" SET "user_id" = default_user_id WHERE "user_id" IS NULL;
    UPDATE "ledger_entries" SET "user_id" = default_user_id WHERE "user_id" IS NULL;
END $$;

-- Make user_id NOT NULL
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "branches" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "ledger_entries" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");
CREATE INDEX "branches_user_id_idx" ON "branches"("user_id");
CREATE INDEX "ledger_entries_user_id_idx" ON "ledger_entries"("user_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Embed Triggers
CREATE OR REPLACE FUNCTION check_allocation_sum()
RETURNS TRIGGER AS $$
DECLARE
  total_allocated DECIMAL(18,2);
  txn_amount DECIMAL(18,2);
BEGIN
  SELECT amount INTO txn_amount
  FROM bank_transactions
  WHERE id = NEW.bank_transaction_id
  FOR UPDATE;

  SELECT COALESCE(SUM(amount_portion), 0) INTO total_allocated
  FROM allocations
  WHERE bank_transaction_id = NEW.bank_transaction_id
    AND status = 'ACTIVE'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  IF (total_allocated + NEW.amount_portion) > txn_amount THEN
    RAISE EXCEPTION
      'Allocation total (%) would exceed bank transaction amount (%) for transaction %',
      (total_allocated + NEW.amount_portion), txn_amount, NEW.bank_transaction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_allocation_sum ON allocations;

CREATE TRIGGER trg_check_allocation_sum
BEFORE INSERT OR UPDATE ON allocations
FOR EACH ROW
EXECUTE FUNCTION check_allocation_sum();

CREATE OR REPLACE FUNCTION sync_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  target_txn_id TEXT;
  total_allocated DECIMAL(18,2);
  txn_amount DECIMAL(18,2);
BEGIN
  target_txn_id := COALESCE(NEW.bank_transaction_id, OLD.bank_transaction_id);

  SELECT amount INTO txn_amount
  FROM bank_transactions WHERE id = target_txn_id;

  SELECT COALESCE(SUM(amount_portion), 0) INTO total_allocated
  FROM allocations WHERE bank_transaction_id = target_txn_id AND status = 'ACTIVE';

  UPDATE bank_transactions
  SET status = CASE
    WHEN total_allocated = 0 THEN 'UNRESOLVED'
    WHEN total_allocated < txn_amount THEN 'PARTIALLY_ALLOCATED'
    ELSE 'MATCHED'
  END::text::"TransactionStatus"
  WHERE id = target_txn_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction_status ON allocations;

CREATE TRIGGER trg_sync_transaction_status
AFTER INSERT OR UPDATE OR DELETE ON allocations
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_status();
