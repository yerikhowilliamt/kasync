-- migration.sql
-- Enforces ADR-003: allocation-sum constraint at the database level.
-- Add this as a Prisma "migrate diff" / raw SQL migration after the initial
-- schema migration generated from schema.prisma.

CREATE OR REPLACE FUNCTION check_allocation_sum()
RETURNS TRIGGER AS $$
DECLARE
  total_allocated DECIMAL(18,2);
  txn_amount DECIMAL(18,2);
BEGIN
  -- Acquire explicit row lock (FOR UPDATE) to guard against check-then-act race conditions
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

-- Optional companion: keep bank_transactions.status in sync automatically
-- whenever allocations change, so the application doesn't have to remember
-- to update it manually on every allocation write path.

CREATE OR REPLACE FUNCTION sync_transaction_status()
RETURNS TRIGGER AS $$
DECLARE
  target_txn_id UUID;
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
  END::"TransactionStatus"
  WHERE id = target_txn_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction_status ON allocations;

CREATE TRIGGER trg_sync_transaction_status
AFTER INSERT OR UPDATE OR DELETE ON allocations
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_status();
