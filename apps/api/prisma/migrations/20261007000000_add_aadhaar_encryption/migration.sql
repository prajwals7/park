-- Migration: Add Aadhaar Field-Level Encryption & Duplicate Index
-- Safe for existing rows (columns are nullable, no existing data altered)

ALTER TABLE "walkers" ADD COLUMN "aadhaarEncrypted" TEXT;
ALTER TABLE "walkers" ADD COLUMN "aadhaarHash" TEXT;

-- Create index on aadhaarHash for fast duplicate checks
CREATE INDEX "walkers_aadhaarHash_idx" ON "walkers"("aadhaarHash");
