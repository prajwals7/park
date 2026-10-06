# Database Design & Relational Specifications

## 1. Entity Design Decisions (1-2 Lines Per Table)

1. **`users`**:
   Stores park staff and administrators with granular roles (`SUPER_ADMIN`, `ADMIN`, `COLLECTOR`), supporting account lockouts (`failedLogins`, `lockedUntil`) and future 2FA TOTP secrets.
2. **`gates`**:
   Enumerates physical entry checkpoints (`G2`, `GS`, `G9`) allowing operational gating and revenue attribution per location.
3. **`walkers`**:
   Maintains core walker profiles with soft-delete capabilities (`deletedAt`, `deletedById`) to protect member historical continuity without data loss.
4. **`passes`**:
   Represents time-bounded 30-day park access intervals, allowing multi-pass historical tracking per walker with instant status indices.
5. **`payments`**:
   Records immutable financial transactions in integer paise with annual sequential receipt numbers; strictly blocks any `UPDATE` or `DELETE` at the database trigger level.
6. **`documents`**:
   Tracks private S3 object keys, MIME types, and SHA-256 integrity checksums for Aadhaar identity proofs, passport photos, and renewal tickets.
7. **`settings`**:
   Stores dynamic, operational parameters (e.g., standard pass fee of 20,000 paise, 30 days validity, 7-day expiration alert window) without hardcoding business constants.
8. **`audit_logs`**:
   Provides an immutable, append-only security ledger capturing actor IDs, state snapshots (`before`/`after`), client IPs, and user agents for every financial or administrative modification.
9. **`refresh_tokens`**:
   Secures long-lived JWT session rotations with hashed tokens and explicit revocation states.
10. **`notification_logs`**:
    Records SMS/WhatsApp reminder dispatches for expiring passes to prevent duplicate messaging and trace communication reliability.

---

## 2. Integrity & Constraint Protections

- **CHECK Constraints**:
  - `chk_payments_amount_positive`: `CHECK ("amountPaise" > 0)` ensures zero or negative values cannot be inserted.
  - `chk_passes_expiry_after_start`: `CHECK ("expiryDate" > "startDate")` guarantees temporal validity.
- **Database-Level Immutability**:
  - `trg_payments_immutable`: PostgreSQL `BEFORE UPDATE OR DELETE` trigger aborts any attempt to modify or delete completed payments.
  - `trg_audit_logs_immutable`: PostgreSQL `BEFORE UPDATE OR DELETE` trigger protects the audit ledger against tampering.
- **Indexes**:
  - High-traffic lookup indexes on `walkers(phone)`, `walkers(passNo)`, `passes(expiryDate)`, `payments(createdAt)`, `payments(gateId)`, and `audit_logs(createdAt)`.

---

## 3. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    users ||--o{ walkers : "creates / deletes"
    users ||--o{ payments : "collects"
    users ||--o{ documents : "uploads"
    users ||--o{ audit_logs : "triggers"
    users ||--o{ refresh_tokens : "owns"

    gates ||--o{ walkers : "assigned to"
    gates ||--o{ payments : "received at"

    walkers ||--o{ passes : "has"
    walkers ||--o{ payments : "pays"
    walkers ||--o{ documents : "owns"
    walkers ||--o{ notification_logs : "receives"

    passes ||--o{ payments : "validates"
    payments ||--o{ documents : "attaches ticket"

    users {
        string id PK
        string name
        string email UK
        string phone
        enum role
        enum status
        string passwordHash
        string totpSecret
        int failedLogins
        datetime lockedUntil
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
    }

    gates {
        string id PK
        string code UK "G2, GS, G9"
        string name
        boolean isActive
    }

    walkers {
        string id PK
        string passNo UK "WPD-YYYY-XXXX"
        string name
        string phone "Indexed"
        string gateId FK
        string aadhaarLast4
        string notes
        datetime consentAt
        datetime deletedAt "Soft delete"
        string deletedById FK
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }

    passes {
        string id PK
        string walkerId FK
        datetime startDate
        datetime expiryDate "Indexed"
        enum status "ACTIVE, EXPIRING, EXPIRED"
        datetime createdAt
    }

    payments {
        string id PK "IMMUTABLE"
        string walkerId FK
        string passId FK
        string gateId FK
        string collectedById FK
        int amountPaise "CHECK > 0"
        enum mode "CASH, UPI"
        enum type "NEW, RENEWAL"
        string receiptNo UK "Sequential"
        string ticketDocId FK
        datetime createdAt "Indexed"
    }

    documents {
        string id PK
        string walkerId FK
        string paymentId FK
        enum type "AADHAAR, PASSPORT, TICKET"
        string storageKey
        string mimeType
        int sizeBytes
        string checksum
        string uploadedById FK
        datetime createdAt
    }

    settings {
        string key PK
        string value
        datetime updatedAt
    }

    audit_logs {
        string id PK "APPEND-ONLY"
        string actorId FK
        string action
        string entity
        string entityId
        json before
        json after
        string ip
        string userAgent
        datetime createdAt "Indexed"
    }

    refresh_tokens {
        string id PK
        string userId FK
        string tokenHash UK
        boolean revoked
        datetime expiresAt
        datetime createdAt
    }

    notification_logs {
        string id PK
        string walkerId FK
        string type
        string channel
        string recipient
        string status
        json payload
        datetime sentAt
        datetime createdAt "Indexed"
    }
```
