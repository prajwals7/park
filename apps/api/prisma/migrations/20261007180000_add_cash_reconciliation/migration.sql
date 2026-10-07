-- Migration to add Cash Reconciliation table and indexes
CREATE TABLE IF NOT EXISTS "cash_reconciliations" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "collectorId" TEXT NOT NULL,
    "gateId" TEXT,
    "expectedCashPaise" INTEGER NOT NULL,
    "handedOverPaise" INTEGER NOT NULL,
    "differencePaise" INTEGER NOT NULL,
    "notes" TEXT,
    "reconciledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_reconciliations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint per collector per date
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cash_reconciliations_date_collectorId_key'
    ) THEN
        ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_date_collectorId_key" UNIQUE ("date", "collectorId");
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "cash_reconciliations_date_idx" ON "cash_reconciliations"("date");
CREATE INDEX IF NOT EXISTS "cash_reconciliations_collectorId_idx" ON "cash_reconciliations"("collectorId");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cash_reconciliations_collectorId_fkey'
    ) THEN
        ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_collectorId_fkey"
        FOREIGN KEY ("collectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cash_reconciliations_reconciledById_fkey'
    ) THEN
        ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_reconciledById_fkey"
        FOREIGN KEY ("reconciledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cash_reconciliations_gateId_fkey'
    ) THEN
        ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_gateId_fkey"
        FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
