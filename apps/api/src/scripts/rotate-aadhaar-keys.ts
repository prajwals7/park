import { PrismaClient } from '@prisma/client';
import { AadhaarCryptoUtil } from '../common/utils/aadhaar-crypto.util.js';
import { env } from '../common/env.js';

const prisma = new PrismaClient();

/**
 * Key Rotation CLI Script:
 * Re-encrypts all stored Aadhaar numbers under a newly specified master key or key version.
 * Run via: tsx src/scripts/rotate-aadhaar-keys.ts <newKeyHex> <newVersion>
 */
async function rotateAadhaarKeys() {
  const args = process.argv.slice(2);
  const newMasterKey = args[0] || env.AADHAAR_MASTER_KEY;
  const newKeyVersion = args[1] || 'v2';

  console.log(`🔑 Starting Aadhaar key rotation to version [${newKeyVersion}]...`);

  const walkers = await prisma.walker.findMany({
    where: {
      aadhaarEncrypted: { not: null },
    },
    select: {
      id: true,
      passNo: true,
      aadhaarEncrypted: true,
    },
  });

  console.log(`Found ${walkers.length} walker records with encrypted Aadhaar data.`);

  let rotatedCount = 0;
  for (const walker of walkers) {
    if (!walker.aadhaarEncrypted) continue;

    try {
      const reEncrypted = AadhaarCryptoUtil.rotate(
        walker.aadhaarEncrypted,
        env.AADHAAR_MASTER_KEY,
        newMasterKey,
        newKeyVersion,
      );

      await prisma.walker.update({
        where: { id: walker.id },
        data: { aadhaarEncrypted: reEncrypted },
      });

      rotatedCount++;
    } catch (err) {
      console.error(`Failed to rotate record for walker ${walker.passNo}:`, err);
    }
  }

  console.log(`✔ Successfully rotated ${rotatedCount} of ${walkers.length} records.`);
}

rotateAadhaarKeys()
  .catch((e) => {
    console.error('Rotation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
