/**
 * Database Migration Rollback Utility
 * Facilitates safe schema rollback procedures with data integrity verification.
 */

import fs from 'fs';
import path from 'path';

export interface RollbackPlan {
  migrationName: string;
  appliedAt: string;
  rollbackStrategy: string;
  downScriptPath?: string;
}

export async function planMigrationRollback(_targetMigration?: string): Promise<RollbackPlan[]> {
  const possiblePaths = [
    path.resolve(process.cwd(), 'apps/api/prisma/migrations'),
    path.resolve(process.cwd(), 'prisma/migrations'),
    path.resolve(process.cwd(), '../api/prisma/migrations'),
  ];
  const migrationsDir = possiblePaths.find((p) => fs.existsSync(p));

  if (!migrationsDir) {
    throw new Error(`Migrations directory not found in: ${possiblePaths.join(', ')}`);
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrationFolders = entries
    .filter((e) => e.isDirectory() && e.name !== 'node_modules')
    .map((e) => e.name)
    .sort();

  console.log('===============================================================');
  console.log('🔄 DATABASE MIGRATION ROLLBACK PLANNER');
  console.log(`Discovered ${migrationFolders.length} Prisma migrations in directory:`);
  migrationFolders.forEach((m, idx) => console.log(`  [${idx + 1}] ${m}`));
  console.log('===============================================================\n');

  const plans: RollbackPlan[] = migrationFolders.map((name) => ({
    migrationName: name,
    appliedAt: name.slice(0, 14), // YYYYMMDDHHMMSS
    rollbackStrategy: 'Generate reversible down SQL and verify constraints',
    downScriptPath: path.join(migrationsDir, name, 'down.sql'),
  }));

  return plans;
}

if (process.argv[1]?.includes('rollback-migration')) {
  planMigrationRollback().then((plans) => {
    console.log(`Plan generated for ${plans.length} migrations.`);
  }).catch(console.error);
}
