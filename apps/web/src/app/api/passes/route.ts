import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/neon-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      'SELECT id, pass_no as "passNo", name, phone, gate_id as "gateId", receipt_no as "receiptNo", amount_paise as "amountPaise", payment_mode as "paymentMode", raw_aadhaar as "rawAadhaar", masked_aadhaar as "maskedAadhaar", aadhaar_photo_url as "aadhaarPhotoUrl", walker_photo_url as "walkerPhotoUrl", receipt_photo_url as "receiptPhotoUrl", issued_at as "issuedAt", expiry_date as "expiryDate", status, notes, renewal_history as "renewalHistory" FROM wpd_cloud_passes ORDER BY issued_at DESC'
    );
    return NextResponse.json({ success: true, passes: rows });
  } catch (error) {
    console.error('API /api/passes GET error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message, passes: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pass = await request.json();
    const sql = getSql();

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
        pass.id,
        pass.passNo,
        pass.name,
        pass.phone,
        pass.gateId,
        pass.receiptNo,
        pass.amountPaise || 20000,
        pass.paymentMode || 'CASH',
        pass.rawAadhaar || null,
        pass.maskedAadhaar || null,
        pass.aadhaarPhotoUrl || null,
        pass.walkerPhotoUrl || null,
        pass.receiptPhotoUrl || null,
        pass.issuedAt || new Date().toISOString(),
        pass.expiryDate,
        pass.status || 'ACTIVE',
        pass.notes || null,
        JSON.stringify(pass.renewalHistory || []),
      ]
    );

    return NextResponse.json({ success: true, pass });
  } catch (error) {
    console.error('API /api/passes POST error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
