-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'COLLECTOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('NEW', 'RENEWAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'PASSPORT', 'TICKET');

-- CreateTable users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'COLLECTOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable gates
CREATE TABLE "gates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable walkers
CREATE TABLE "walkers" (
    "id" TEXT NOT NULL,
    "passNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "aadhaarLast4" TEXT,
    "notes" TEXT,
    "consentAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "walkers_pkey" PRIMARY KEY ("id")
);

-- CreateTable passes
CREATE TABLE "passes" (
    "id" TEXT NOT NULL,
    "walkerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "PassStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable payments
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "walkerId" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "type" "PaymentType" NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "ticketDocId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable documents
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "walkerId" TEXT NOT NULL,
    "paymentId" TEXT,
    "type" "DocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable settings
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable notification_logs
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "walkerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "gates_code_key" ON "gates"("code");
CREATE UNIQUE INDEX "walkers_passNo_key" ON "walkers"("passNo");
CREATE UNIQUE INDEX "payments_receiptNo_key" ON "payments"("receiptNo");
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- Indexes
CREATE INDEX "walkers_phone_idx" ON "walkers"("phone");
CREATE INDEX "walkers_passNo_idx" ON "walkers"("passNo");
CREATE INDEX "walkers_deletedAt_idx" ON "walkers"("deletedAt");

CREATE INDEX "passes_expiryDate_idx" ON "passes"("expiryDate");
CREATE INDEX "passes_walkerId_status_idx" ON "passes"("walkerId", "status");

CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");
CREATE INDEX "payments_gateId_idx" ON "payments"("gateId");
CREATE INDEX "payments_walkerId_idx" ON "payments"("walkerId");

CREATE INDEX "documents_walkerId_idx" ON "documents"("walkerId");
CREATE INDEX "documents_storageKey_idx" ON "documents"("storageKey");

CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "notification_logs_walkerId_idx" ON "notification_logs"("walkerId");
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- Foreign Keys
ALTER TABLE "walkers" ADD CONSTRAINT "walkers_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "walkers" ADD CONSTRAINT "walkers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "walkers" ADD CONSTRAINT "walkers_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "passes" ADD CONSTRAINT "passes_walkerId_fkey" FOREIGN KEY ("walkerId") REFERENCES "walkers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_walkerId_fkey" FOREIGN KEY ("walkerId") REFERENCES "walkers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_passId_fkey" FOREIGN KEY ("passId") REFERENCES "passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_ticketDocId_fkey" FOREIGN KEY ("ticketDocId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_walkerId_fkey" FOREIGN KEY ("walkerId") REFERENCES "walkers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_walkerId_fkey" FOREIGN KEY ("walkerId") REFERENCES "walkers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK Constraints
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount_positive" CHECK ("amountPaise" > 0);
ALTER TABLE "passes" ADD CONSTRAINT "chk_passes_expiry_after_start" CHECK ("expiryDate" > "startDate");

-- Immutability Functions & Triggers for payments and audit_logs
CREATE OR REPLACE FUNCTION prevent_modification_payments()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Payments table is strictly immutable. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_immutable
BEFORE UPDATE OR DELETE ON "payments"
FOR EACH ROW
EXECUTE FUNCTION prevent_modification_payments();

CREATE OR REPLACE FUNCTION prevent_modification_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs table is strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_modification_audit_logs();
