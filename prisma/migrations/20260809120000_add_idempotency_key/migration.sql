-- AlterTable
ALTER TABLE "allocations" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "allocations_idempotency_key_key" ON "allocations"("idempotency_key");
