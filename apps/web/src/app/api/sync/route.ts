import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/neon-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = getSql();
    const [passesRows, collectorsRows] = await Promise.all([
      sql.query(
        'SELECT id, pass_no as "passNo", name, phone, gate_id as "gateId", receipt_no as "receiptNo", amount_paise as "amountPaise", payment_mode as "paymentMode", raw_aadhaar as "rawAadhaar", masked_aadhaar as "maskedAadhaar", aadhaar_photo_url as "aadhaarPhotoUrl", walker_photo_url as "walkerPhotoUrl", receipt_photo_url as "receiptPhotoUrl", issued_at as "issuedAt", expiry_date as "expiryDate", status, notes, renewal_history as "renewalHistory" FROM wpd_cloud_passes ORDER BY issued_at DESC'
      ),
      sql.query(
        'SELECT id, collector_id as "collectorId", name, email, phone, password, gate, assigned_gate as "assignedGate", shift, status, created_at as "createdAt", cancelled_at as "cancelledAt", cancel_reason as "cancelReason" FROM wpd_cloud_collectors ORDER BY created_at DESC'
      ),
    ]);

    return NextResponse.json({
      success: true,
      passes: passesRows,
      collectors: collectorsRows,
    });
  } catch (error) {
    console.error('API /api/sync GET error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message, passes: [], collectors: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passes = [], collectors = [] } = body;
    const sql = getSql();

    // Upsert passes
    for (const p of passes) {
      await sql.query(
        `INSERT INTO wpd_cloud_passes 
         (id, pass_no, name, phone, gate_id, receipt_no, amount_paise, payment_mode, raw_aadhaar, masked_aadhaar, aadhaar_photo_url, walker_photo_url, receipt_photo_url, issued_at, expiry_date, status, notes, renewal_history, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
         ON CONFLICT (id) DO UPDATE SET
           pass_no = EXCLUDED.pass_no,
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           gate_id = EXCLUDED.gate_id,
           receipt_no = EXCLUDED.receipt_no,
           amount_paise = EXCLUDED.amount_paise,
           payment_mode = EXCLUDED.payment_mode,
           raw_aadhaar = EXCLUDED.raw_aadhaar,
           masked_aadhaar = EXCLUDED.masked_aadhaar,
           aadhaar_photo_url = COALESCE(EXCLUDED.aadhaar_photo_url, wpd_cloud_passes.aadhaar_photo_url),
           walker_photo_url = COALESCE(EXCLUDED.walker_photo_url, wpd_cloud_passes.walker_photo_url),
           receipt_photo_url = COALESCE(EXCLUDED.receipt_photo_url, wpd_cloud_passes.receipt_photo_url),
           issued_at = EXCLUDED.issued_at,
           expiry_date = EXCLUDED.expiry_date,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           renewal_history = EXCLUDED.renewal_history,
           updated_at = NOW()`,
        [
          p.id,
          p.passNo,
          p.name,
          p.phone,
          p.gateId,
          p.receiptNo,
          p.amountPaise || 20000,
          p.paymentMode || 'CASH',
          p.rawAadhaar || null,
          p.maskedAadhaar || null,
          p.aadhaarPhotoUrl || null,
          p.walkerPhotoUrl || null,
          p.receiptPhotoUrl || null,
          p.issuedAt,
          p.expiryDate,
          p.status || 'ACTIVE',
          p.notes || null,
          JSON.stringify(p.renewalHistory || []),
        ]
      );
    }

    // Upsert collectors
    for (const c of collectors) {
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
          c.id,
          c.collectorId,
          c.name,
          c.email,
          c.phone,
          c.password || 'Collector@123',
          c.gate,
          c.assignedGate || c.gate,
          c.shift || 'General',
          c.status || 'ACTIVE',
          c.createdAt || new Date().toISOString(),
          c.cancelledAt || null,
          c.cancelReason || null,
        ]
      );
    }

    return NextResponse.json({ success: true, countPasses: passes.length, countCollectors: collectors.length });
  } catch (error) {
    console.error('API /api/sync POST error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
