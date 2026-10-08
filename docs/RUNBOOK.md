# Operations & Incident Runbook

**System**: Walker Pass Desk  
**Version**: 1.0.0 (Production)  
**Classification**: Internal Operational SOP  
**Last Updated**: October 2026  

---

## 1. System Topology & Architecture

Walker Pass Desk operates as a containerized microservice stack:
- **Reverse Proxy**: Nginx 1.25 (TLS 1.2/1.3 termination, rate limiting, HSTS, HTTP/2).
- **Backend API (`@wpd/api`)**: NestJS on Node 20 with Prisma ORM, Argon2id, and AES-256-GCM envelope cryptography.
- **Frontend Web (`@wpd/web`)**: Next.js 15 standalone application with responsive mobile-first collector layout and desktop admin dashboard.
- **Database**: Managed PostgreSQL 16 (Multi-AZ, SSL `require`, automated point-in-time recovery).
- **Document Vault**: Private S3-compliant Object Storage (AWS S3 in production / MinIO in local dev) with server-side encryption.
- **Monitoring**: Sentry for error tracking; JSON structured logging; `/health` and `/health/ready` probe endpoints.

---

## 2. Incident Management & Severity Matrix

### 2.1. Severity Levels

| Severity | Definition | Target Response | Target Resolution | Examples |
| :--- | :--- | :---: | :---: | :--- |
| **P1 - Critical** | Complete desk outage, payment/renew failure at gates, database down, security breach or secret leak. | **< 15 mins** | **< 2 hours** | Gates unable to issue passes; database connection pool exhaustion; plain Aadhaar leak. |
| **P2 - Major** | Degraded performance, report export timeouts, single gate connectivity failure, non-critical background job failure. | **< 1 hour** | **< 6 hours** | Daily reconciliation reports timing out; image upload slow; single collector device failure. |
| **P3 - Minor** | Cosmetic UI bugs, minor log warnings, non-blocking telemetry issues. | **< 4 hours** | **< 24 hours** | Typo in pass print preview; non-critical dashboard chart aesthetic bug. |

### 2.2. Incident Escalation & Response Steps

1. **Acknowledge & Triage**:
   - Check uptime monitor alert (Pingdom / BetterStack) and Sentry error dashboard.
   - Verify health probe status:
     ```bash
     curl -i https://walkerpass.park.gov.in/health
     curl -i https://walkerpass.park.gov.in/health/ready
     ```
2. **Containment**:
   - For suspected credential compromises or security anomalies, immediately revoke active sessions:
     ```bash
     # Terminate all active collector sessions via Redis / database
     pnpm --filter @wpd/api db:seed # or execute revoke script
     ```
3. **Investigation & Logs**:
   - Inspect structured JSON production logs:
     ```bash
     docker compose -f docker-compose.prod.yml logs --tail=200 -f api
     docker compose -f docker-compose.prod.yml logs --tail=100 -f nginx
     ```
4. **Resolution & Rollback**:
   - Follow the Disaster Recovery or Migration Rollback SOP below if code or migration is at fault.
5. **Post-Incident Review (PIR)**:
   - File blameless root cause analysis within 24 hours of P1 incident closure.

---

## 3. Automated Backup & Disaster Recovery / Restore SOP

### 3.1. Automated Daily Backup Procedure
Backups are executed daily at 02:00 IST via cron or managed cloud snapshots, producing gzip-compressed, SHA-256 verified archives:

```bash
# Execute manual or scheduled backup
pnpm tsx scripts/backup-db.ts

# Backup outputs:
# - deploy/backups/wpd-backup-YYYY-MM-DDTHH-MM-SS.sql.gz
# - deploy/backups/wpd-backup-YYYY-MM-DDTHH-MM-SS.sql.gz.sha256
```

### 3.2. Tested Restore Procedure
> **CRITICAL**: Restores should first be verified with `--dryRun` or against a staging instance before production execution.

1. **Verify Integrity Checksum**:
   ```bash
   sha256sum -c deploy/backups/wpd-backup-<TIMESTAMP>.sql.gz.sha256
   ```
2. **Execute Dry-Run Verification**:
   ```bash
   pnpm tsx scripts/restore-db.ts deploy/backups/wpd-backup-<TIMESTAMP>.sql.gz --dryRun
   ```
3. **Execute Production Database Restore**:
   ```bash
   # Set target database URL
   export DATABASE_URL="postgresql://user:pass@pg-host:5432/walker_pass_desk"
   
   # Run verified restore
   pnpm tsx scripts/restore-db.ts deploy/backups/wpd-backup-<TIMESTAMP>.sql.gz
   ```
4. **Post-Restore Verification**:
   ```bash
   # Check database connectivity and table counts
   curl -f https://walkerpass.park.gov.in/health/ready
   ```

---

## 4. Database Migration Rollback SOP

When a newly deployed Prisma migration causes unexpected errors or schema incompatibility:

### 4.1. Rollback Planning
1. Run the Migration Rollback Planner:
   ```bash
   pnpm tsx scripts/rollback-migration.ts
   ```
2. Inspect the latest applied migration in `apps/api/prisma/migrations/`.

### 4.2. Rollback Execution
1. Mark the migration as rolled back in Prisma's tracking table:
   ```bash
   cd apps/api
   npx prisma migrate resolve --rolled-back "<MIGRATION_FOLDER_NAME>"
   ```
2. Apply the reverse schema changes via down script:
   ```bash
   # If down.sql is provided in migration folder:
   psql "$DATABASE_URL" -f "prisma/migrations/<MIGRATION_FOLDER_NAME>/down.sql"
   ```
3. Re-verify application readiness:
   ```bash
   curl -f http://localhost:4000/health/ready
   ```

---

## 5. Staff User Onboarding & Access Management SOP

### 5.1. Roles & Permissions Hierarchy
- **`SUPER_ADMIN`**: Full system governance, park gate configuration, pass tariff & validity settings, user role elevation, and compliance audit exports. Mandatory 2FA.
- **`ADMIN`**: Staff user creation/suspension, password reset, walker edits, soft deletes, report exports, cash reconciliation, and audited Aadhaar reveal. Mandatory 2FA.
- **`COLLECTOR`**: Mobile gate desk operations, walker registration, physical pass renewals, and receipt slip entry.

### 5.2. Onboarding a New Staff Collector
1. Admin navigates to **Admin Dashboard -> Staff Users -> + Add User**.
2. Fill staff details:
   - **Name**: e.g. `Ramesh Kumar`
   - **Email**: `ramesh.gate2@parkdesk.in`
   - **Phone**: 10-digit Indian mobile number
   - **Role**: `COLLECTOR`
   - **Temporary Password**: Must meet strict complexity policy (Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol).
3. The staff member logs in at the gate desk and is prompted to change their temporary password immediately upon first access.

### 5.3. Onboarding an Administrator (Mandatory 2FA Setup)
1. SuperAdmin creates the administrator account with role `ADMIN`.
2. Admin logs in with email and password.
3. System forces TOTP 2FA enrollment:
   - Scan QR code using Google Authenticator / Aegis.
   - Enter 6-digit TOTP token to confirm setup.
   - Record generated 10 backup recovery codes in an encrypted password manager.

### 5.4. Offboarding / Immediate Suspension SOP
1. In the event of staff departure or suspected security breach:
2. Navigate to **Admin Dashboard -> Staff Users**.
3. Toggle account status to **DISABLED**.
4. The API immediately:
   - Updates `status: DISABLED` in database.
   - Revokes all active refresh tokens for the user in `refresh_tokens`.
   - Rejects existing short-lived access tokens upon next request.
   - Logs `USER_STATUS_UPDATED` with reason in the immutable audit log.

---

## 6. Cryptographic Key Rotation SOP (Aadhaar AES-256-GCM)

All 12-digit Aadhaar numbers are stored under envelope encryption using `AADHAAR_MASTER_KEY` (AES-256-GCM) with version tagging (e.g. `keyVersion: "v1"`).

### 6.1. Key Rotation Schedule
- Root Master Key must be rotated every **12 months** or immediately upon suspected key exposure.

### 6.2. Zero-Downtime Key Rotation Steps
1. **Generate New 256-bit Hex Master Key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Store New Key in Secrets Manager**:
   - Store as `AADHAAR_MASTER_KEY_V2`.
   - Update `AADHAAR_KEY_VERSION=v2`.
3. **Execute Online Re-Encryption Batch**:
   - The application supports decrypting legacy `v1` records using the archived `v1` key while writing all new registrations under `v2`.
   - Run the re-encryption batch utility:
     ```bash
     # Re-encrypts all rows in walkers table from v1 to v2
     pnpm --filter @wpd/api tsx scripts/rotate-aadhaar-keys.ts
     ```
4. **Decommission Old Key**:
   - Confirm zero remaining `keyVersion: "v1"` records in database.
   - Archive `v1` key securely according to document retention guidelines.

---

## 7. Monitoring, Sentry & Uptime Alerts SOP

### 7.1. Uptime Probes
Configure external monitoring (e.g. BetterStack, UptimeRobot, or AWS Route53 Health Checks):
- **Liveness Probe**: `GET https://walkerpass.park.gov.in/health`
  - Expected: HTTP 200, `{ "status": "ok" }`
  - Frequency: Every 30 seconds
  - Alert Threshold: 2 consecutive failures -> Page On-Call Engineer.
- **Readiness Probe**: `GET https://walkerpass.park.gov.in/health/ready`
  - Expected: HTTP 200, checks `{ "database": "healthy", "storage": "healthy" }`
  - Frequency: Every 60 seconds.

### 7.2. Error Monitoring (Sentry)
- Unhandled 500 errors and unhandled rejections are sanitized (all Aadhaar numbers automatically redacted via `AadhaarCryptoUtil.redact`) before transmission.
- Alert Rule: > 5 errors in 5 minutes -> Slack `#park-desk-alerts` channel.
- Alert Rule: Any P1 Authentication Lockout spike (> 50 in 10 minutes) -> Security On-Call.

---

## 8. Verification Commands Cheat Sheet

```bash
# Verify entire test suite (146 tests)
pnpm -r test

# Verify production Next.js build
pnpm --filter @wpd/web build

# Verify production Nest.js build
pnpm --filter @wpd/api build

# Run high-concurrency performance benchmark
pnpm tsx scripts/load-test.ts

# Execute manual backup test
pnpm tsx scripts/backup-db.ts
```
