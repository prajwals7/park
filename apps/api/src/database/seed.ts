import {
  PrismaClient,
  Role,
  UserStatus,
  PassStatus,
  PaymentMode,
  PaymentType,
  DocumentType,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed for Walker Pass Desk...');

  // 1. Clean existing records in reverse dependency order
  await prisma.notificationLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.pass.deleteMany();
  await prisma.walker.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.setting.deleteMany();

  // 2. Seed System Settings
  await prisma.setting.createMany({
    data: [
      { key: 'PASS_PRICE_PAISE', value: '20000' },
      { key: 'VALIDITY_DAYS', value: '30' },
      { key: 'EXPIRING_THRESHOLD_DAYS', value: '7' },
      { key: 'PARK_NAME', value: 'Cubbon Park Walker Desk' },
      { key: 'TIMEZONE', value: 'Asia/Kolkata' },
    ],
  });
  console.log('✔ Seeded system settings');

  // 3. Seed Gates (G2, GS, G9)
  const gateG2 = await prisma.gate.create({
    data: { code: 'G2', name: 'Gate 2 - North Pavilion', isActive: true },
  });
  const gateGS = await prisma.gate.create({
    data: { code: 'GS', name: 'Gate GS - South Entrance', isActive: true },
  });
  const gateG9 = await prisma.gate.create({
    data: { code: 'G9', name: 'Gate 9 - Lake Boulevard', isActive: true },
  });
  const gates = [gateG2, gateGS, gateG9];
  console.log('✔ Seeded 3 gates (G2, GS, G9)');

  // 4. Seed Users (one per role)
  const defaultPasswordHash = await bcrypt.hash('Admin@12345', 10);

  await prisma.user.create({
    data: {
      name: 'Dr. Ramesh Kumar',
      email: 'superadmin@walkerpass.gov.in',
      phone: '9845012345',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: defaultPasswordHash,
      lastLoginAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      name: 'Sunita Rao',
      email: 'admin@walkerpass.gov.in',
      phone: '9845023456',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: defaultPasswordHash,
      lastLoginAt: new Date(),
    },
  });

  const collector = await prisma.user.create({
    data: {
      name: 'Anand Murthy',
      email: 'collector@walkerpass.gov.in',
      phone: '9845034567',
      role: Role.COLLECTOR,
      status: UserStatus.ACTIVE,
      passwordHash: defaultPasswordHash,
      lastLoginAt: new Date(),
    },
  });
  console.log('✔ Seeded staff users (SUPER_ADMIN, ADMIN, COLLECTOR)');

  // 5. Seed 25 Realistic Walkers across ACTIVE, EXPIRING, and EXPIRED statuses
  const indianNames = [
    'Aarav Sharma',
    'Aditi Nair',
    'Arjun Patel',
    'Bhavna Kulkarni',
    'Chetan Deshmukh',
    'Deepa Iyer',
    'Girish Hegde',
    'Hemant Varma',
    'Indira Rao',
    'Jagdish Joshi',
    'Kavita Reddy',
    'Laxman Prabhu',
    'Meera Bhatt',
    'Naveen Shenoy',
    'Padma Venkatesh',
    'Raghav Menon',
    'Sangeeta Pillai',
    'Tanvi Mahajan',
    'Umesh Nayak',
    'Vasudha Sen',
    'Vikram Chawla',
    'Yashwant Kale',
    'Pooja Hegde',
    'Kiran Mazumdar',
    'Suresh Gopinath',
  ];

  const now = new Date('2026-10-06T12:00:00.000Z');

  for (let i = 0; i < 25; i++) {
    const name = indianNames[i]!;
    const phone = `9880${String(100000 + i).slice(1)}`;
    const passNo = `PASS-${String(1001 + i)}`;
    const assignedGate = gates[i % 3]!;
    const aadhaar4 = String(2000 + ((i * 137) % 8000)).padStart(4, '0');

    // Status distribution:
    // i = 0..11  -> ACTIVE (expiry in 12 to 28 days)
    // i = 12..17 -> EXPIRING (expiry in 1 to 6 days)
    // i = 18..24 -> EXPIRED (expiry in past 1 to 20 days)
    let startDate: Date;
    let expiryDate: Date;
    let passStatus: PassStatus;
    let paymentType: PaymentType;

    if (i < 12) {
      passStatus = PassStatus.ACTIVE;
      const daysLeft = 12 + (i % 15);
      startDate = new Date(now.getTime() - (30 - daysLeft) * 24 * 60 * 60 * 1000);
      expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      paymentType = i % 2 === 0 ? PaymentType.NEW : PaymentType.RENEWAL;
    } else if (i < 18) {
      passStatus = PassStatus.EXPIRING;
      const daysLeft = 1 + (i % 6);
      startDate = new Date(now.getTime() - (30 - daysLeft) * 24 * 60 * 60 * 1000);
      expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      paymentType = PaymentType.RENEWAL;
    } else {
      passStatus = PassStatus.EXPIRED;
      const daysAgo = 2 + (i - 18) * 3;
      expiryDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      startDate = new Date(expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      paymentType = PaymentType.NEW;
    }

    // Create Walker
    const walker = await prisma.walker.create({
      data: {
        passNo,
        name,
        phone,
        gateId: assignedGate.id,
        aadhaarLast4: aadhaar4,
        notes: i % 4 === 0 ? 'Senior citizen regular morning walker' : null,
        consentAt: startDate,
        createdById: collector.id,
        createdAt: startDate,
      },
    });

    // Create Pass
    const pass = await prisma.pass.create({
      data: {
        walkerId: walker.id,
        startDate,
        expiryDate,
        status: passStatus,
        createdAt: startDate,
      },
    });

    // Documents
    await prisma.document.create({
      data: {
        walkerId: walker.id,
        type: DocumentType.AADHAAR,
        storageKey: `documents/${walker.id}/aadhaar_${aadhaar4}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 350,
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: collector.id,
        createdAt: startDate,
      },
    });

    await prisma.document.create({
      data: {
        walkerId: walker.id,
        type: DocumentType.PASSPORT,
        storageKey: `documents/${walker.id}/photo_${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 180,
        checksum: 'd41d8cd98f00b204e9800998ecf8427e',
        uploadedById: collector.id,
        createdAt: startDate,
      },
    });

    let ticketDocId: string | undefined = undefined;
    if (paymentType === PaymentType.RENEWAL) {
      const ticketDoc = await prisma.document.create({
        data: {
          walkerId: walker.id,
          type: DocumentType.TICKET,
          storageKey: `documents/${walker.id}/ticket_renewal_${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1024 * 220,
          checksum: '6e442c55e975762da630c9fa733d99d9b04ab6e36d8da075e7a9e6b4d3202e2c',
          uploadedById: collector.id,
          createdAt: startDate,
        },
      });
      ticketDocId = ticketDoc.id;
    }

    // Physical Receipt record supplied by collector (RC-000101 format)
    const receiptNo = `RC-${String(100101 + i)}`;
    const payment = await prisma.payment.create({
      data: {
        walkerId: walker.id,
        passId: pass.id,
        gateId: assignedGate.id,
        collectedById: collector.id,
        amountPaise: 20000,
        mode: i % 2 === 0 ? PaymentMode.CASH : PaymentMode.UPI,
        type: paymentType,
        receiptNo,
        ticketDocId: ticketDocId || null,
        createdAt: startDate,
      },
    });

    // Link document to payment if applicable
    if (ticketDocId) {
      await prisma.document.update({
        where: { id: ticketDocId },
        data: { paymentId: payment.id },
      });
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: collector.id,
        action: paymentType === PaymentType.NEW ? 'REGISTER_WALKER' : 'RENEW_PASS',
        entity: 'Walker',
        entityId: walker.id,
        after: {
          passNo: walker.passNo,
          name: walker.name,
          gate: assignedGate.code,
          receiptNo,
          amountPaise: 20000,
        },
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WalkerDesk/1.0',
        createdAt: startDate,
      },
    });
  }

  console.log(
    '✔ Seeded 25 realistic walkers across ACTIVE (12), EXPIRING (6), and EXPIRED (7) statuses with immutable payment and pass histories',
  );
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
