import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/neon-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      'SELECT id, collector_id as "collectorId", name, email, phone, password, gate, assigned_gate as "assignedGate", shift, status, created_at as "createdAt", cancelled_at as "cancelledAt", cancel_reason as "cancelReason" FROM wpd_cloud_collectors ORDER BY created_at DESC'
    );
    return NextResponse.json({ success: true, collectors: rows });
  } catch (error) {
    console.error('API /api/collectors GET error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message, collectors: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const collector = await request.json();
    const sql = getSql();

    await sql.query(
      `INSERT INTO wpd_cloud_collectors
       (id, collector_id, name, email, phone, password, gate, assigned_gate, shift, status, created_at, cancelled_at, cancel_reason, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (id) DO UPDATE SET
         collector_id = EXCLUDED.collector_id,
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         password = EXCLUDED.password,
         gate = EXCLUDED.gate,
         assigned_gate = EXCLUDED.assigned_gate,
         shift = EXCLUDED.shift,
         status = EXCLUDED.status,
         cancelled_at = EXCLUDED.cancelled_at,
         cancel_reason = EXCLUDED.cancel_reason,
         updated_at = NOW()`,
      [
        collector.id,
        collector.collectorId,
        collector.name,
        collector.email,
        collector.phone,
        collector.password || 'Collector@123',
        collector.gate,
        collector.assignedGate || collector.gate,
        collector.shift || 'General',
        collector.status || 'ACTIVE',
        collector.createdAt || new Date().toISOString(),
        collector.cancelledAt || null,
        collector.cancelReason || null,
      ]
    );

    return NextResponse.json({ success: true, collector });
  } catch (error) {
    console.error('API /api/collectors POST error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
