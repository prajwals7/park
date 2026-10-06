# Walker Pass Desk 🎟️

A secure, production-grade ticketing and pass renewal management system for large walking parks in India.

## Monorepo Architecture

```
park/
├── apps/
│   ├── api/        # NestJS REST API, Prisma ORM, Auth, S3 storage
│   └── web/        # Next.js 15 App Router, Tailwind CSS, shadcn/ui
├── packages/
│   └── shared/     # Shared Zod schemas, types, constants, business logic
├── docker-compose.yml # PostgreSQL 16 & MinIO object storage
├── docs/
│   └── ARCHITECTURE.md # Comprehensive architecture and security guide
└── package.json    # pnpm workspaces root
```

---

## Prerequisites

- **Node.js**: >= 20.x
- **pnpm**: >= 9.x / 10.x (`npm install -g pnpm`)
- **Docker & Docker Compose** (for local PostgreSQL & MinIO S3)

---

## Quickstart Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

### 3. Spin up PostgreSQL & MinIO

```bash
pnpm docker:up
```

MinIO web console is accessible at `http://localhost:9001` (login: `minioadmin` / `minioadminpassword`).

### 4. Database Migration & Seed

Run Prisma migrations and populate baseline staff roles & gate accounts:

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start Development Servers

Run all monorepo apps concurrently:

```bash
pnpm dev
```

Or start individually:

```bash
pnpm dev:api    # NestJS API running on http://localhost:4000
pnpm dev:web    # Next.js web app running on http://localhost:3000
```

---

## Scripts Reference

| Command             | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `pnpm dev`          | Run all applications in watch mode concurrently            |
| `pnpm dev:api`      | Run NestJS API server                                      |
| `pnpm dev:web`      | Run Next.js frontend                                       |
| `pnpm build`        | Compile shared packages, API, and Next.js production build |
| `pnpm test`         | Run all test suites across packages with Vitest            |
| `pnpm lint`         | Enforce ESLint rules across all TypeScript code            |
| `pnpm format`       | Auto-format files with Prettier                            |
| `pnpm format:check` | Check code formatting compliance                           |
| `pnpm db:migrate`   | Apply Prisma schema migrations                             |
| `pnpm db:generate`  | Regenerate Prisma client                                   |
| `pnpm db:seed`      | Seed default users (Super Admin, Admins, Gate Collectors)  |
| `pnpm docker:up`    | Spin up local PostgreSQL and MinIO containers              |
| `pnpm docker:down`  | Stop local containers                                      |

---

## Non-Negotiable Engineering Rules Enforced

1. **Strict TypeScript & Zero Any**: Enforced across packages and apps.
2. **Standard Error Contract**: Every error response returns `{ code, message, details }`. SQL errors or stack traces are never leaked.
3. **Integer Paise Storage**: Monetary amounts are stored in paise (Rs 200 = 20,000 paise).
4. **UTC Datetime & Asia/Kolkata Display**: DB strictly stores UTC; display formats to `Asia/Kolkata`.
5. **Database Transactions**: All money operations and renewal extensions are atomic and log an audit record.
6. **Soft Deletions & Immutable Payments**: Walker records are soft-deleted; payment records cannot be updated or deleted.
