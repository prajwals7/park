-- Safe Migration for Physical Payment Receipt Numbers and Admin Correction
-- Safe for existing rows in payments table

-- 1. Add payment correction tracking fields
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isCorrected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "correctionReason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "correctedById" TEXT;

-- 2. Add Foreign Key for correctedById -> users(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_correctedById_fkey'
    ) THEN
        ALTER TABLE "payments" ADD CONSTRAINT "payments_correctedById_fkey"
        FOREIGN KEY ("correctedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Drop any auto-sequence for receipt numbers if present
DROP SEQUENCE IF EXISTS payments_receipt_no_seq;

-- 4. Update Immutability Trigger Function for Payments:
-- - DELETE is unconditionally forbidden for all users.
-- - UPDATE is forbidden EXCEPT in an authorized ADMIN correction transaction where
--   session setting 'app.allow_payment_correction' = 'on'.
-- - Even under correction, amountPaise, walkerId, passId, collectedById, createdAt, and type
--   CANNOT be modified.
CREATE OR REPLACE FUNCTION prevent_modification_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Payments table is strictly immutable. DELETE operations are forbidden.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Allow updates only when explicitly authorized in an admin correction transaction
        IF current_setting('app.allow_payment_correction', true) = 'on' THEN
            -- Ensure immutable financial and audit lineage fields cannot be altered
            IF NEW."amountPaise" != OLD."amountPaise" OR
               NEW."walkerId" != OLD."walkerId" OR
               NEW."passId" != OLD."passId" OR
               NEW."createdAt" != OLD."createdAt" OR
               NEW."type" != OLD."type" OR
               NEW."collectedById" != OLD."collectedById" THEN
                RAISE EXCEPTION 'Financial and audit lineage fields (amount, walker, pass, collector, timestamp, type) cannot be modified.';
            END IF;
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Payments table is strictly immutable. Direct UPDATE operations are forbidden.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
