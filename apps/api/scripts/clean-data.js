const { PrismaClient } = require('@prisma/client');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging all existing walkers, passes, payments, documents, and notifications...');

  // 1. Temporarily disable the immutability trigger on payments table
  await prisma.$executeRawUnsafe(`ALTER TABLE "payments" DISABLE TRIGGER trg_payments_immutable;`);
  console.log('✔ Disabled payments immutability trigger for cleanup');

  try {
    // 2. Delete child records and parent pass/walker records
    const notifs = await prisma.notificationLog.deleteMany();
    console.log(`✔ Removed ${notifs.count} notification logs`);

    const docs = await prisma.document.deleteMany();
    console.log(`✔ Removed ${docs.count} documents`);

    const payments = await prisma.payment.deleteMany();
    console.log(`✔ Removed ${payments.count} payments`);

    const passes = await prisma.pass.deleteMany();
    console.log(`✔ Removed ${passes.count} passes`);

    await prisma.$executeRawUnsafe(`DELETE FROM "cash_reconciliations";`).catch(() => 0);
    console.log(`✔ Cleared cash reconciliations`);

    const walkers = await prisma.walker.deleteMany();
    console.log(`✔ Removed ${walkers.count} walkers`);

    // Reset any temporary test tokens if any
    await prisma.refreshToken.deleteMany();
    console.log('✔ Cleared session refresh tokens');

    console.log('✨ Clean slate achieved! All passes, walkers, payments, and documents purged successfully.');
  } finally {
    // 3. Always re-enable payments immutability trigger
    await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ENABLE TRIGGER trg_payments_immutable;`);
    console.log('✔ Re-enabled payments immutability trigger');
  }

  // 4. Report remaining state
  const userCount = await prisma.user.count();
  const gateCount = await prisma.gate.count();
  const walkerCount = await prisma.walker.count();
  const passCount = await prisma.pass.count();

  console.log('--------------------------------------------------');
  console.log(`Database Status:`);
  console.log(`- Active Staff Users : ${userCount}`);
  console.log(`- Configured Gates   : ${gateCount}`);
  console.log(`- Walkers Remaining  : ${walkerCount}`);
  console.log(`- Passes Remaining   : ${passCount}`);
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Failed to clean data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
