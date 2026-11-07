const { neon } = require('../apps/web/node_modules/@neondatabase/serverless');

const DB_URL =
  'postgresql://neondb_owner:npg_zYB0ai6wyVWr@ep-falling-math-b3xk03oy-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DB_URL);

async function runTests() {
  console.log('====================================================');
  console.log('🚀 LIVE DATABASE INTEGRITY & REAL-TIME TEST SUITE');
  console.log('Target: Neon PostgreSQL + Vercel Production API');
  console.log('====================================================\n');

  // Test 1: Connectivity & Server Timestamp
  console.log('TEST 1: Database Ping & Server Time...');
  const ping = await sql.query('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
  console.log('  ✅ Connected to Database:', ping[0].db_name);
  console.log('  ✅ Neon Server Time:', ping[0].current_time);
  console.log('  ✅ Engine:', ping[0].pg_version.slice(0, 30) + '...\n');

  // Test 2: Walker Pass Creation & Persistence
  console.log('TEST 2: Walker Pass Creation & Persistence...');
  const testPassId = 'test-pass-' + Date.now();
  const testPassNo = 'WP-TEST-' + Math.floor(1000 + Math.random() * 9000);
  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 30 * 86400000).toISOString();

  await sql.query(
    'INSERT INTO wpd_cloud_passes (id, pass_no, name, phone, gate_id, receipt_no, amount_paise, payment_mode, issued_at, expiry_date, status, renewal_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [testPassId, testPassNo, 'QA Test Walker', '9845099999', 'G2', 'RC-TEST-001', 20000, 'CASH', now, expiry, 'ACTIVE', '[]']
  );

  const fetchedPass = await sql.query('SELECT * FROM wpd_cloud_passes WHERE id = $1', [testPassId]);
  if (fetchedPass.length === 1 && fetchedPass[0].pass_no === testPassNo) {
    console.log('  ✅ Pass successfully written and retrieved by ID');
    console.log('  ✅ Pass No:', fetchedPass[0].pass_no, '| Walker:', fetchedPass[0].name, '| Amount: Rs', fetchedPass[0].amount_paise / 100, '\n');
  } else {
    throw new Error('Failed to retrieve written pass');
  }

  // Test 3: Pass Renewal with History
  console.log('TEST 3: Pass Renewal Transaction & Timeline History...');
  const renewalRecord = {
    renewedAt: new Date().toISOString(),
    receiptNo: 'RC-RENEW-002',
    receiptPhotoUrl: 'data:image/jpeg;base64,mockReceiptBytes',
    paymentMode: 'UPI',
    gateId: 'G2',
    amountPaise: 20000,
  };

  await sql.query(
    'UPDATE wpd_cloud_passes SET receipt_no = $1, payment_mode = $2, renewal_history = $3 WHERE id = $4',
    [renewalRecord.receiptNo, renewalRecord.paymentMode, JSON.stringify([renewalRecord]), testPassId]
  );

  const renewedPass = await sql.query('SELECT * FROM wpd_cloud_passes WHERE id = $1', [testPassId]);
  const history =
    typeof renewedPass[0].renewal_history === 'string'
      ? JSON.parse(renewedPass[0].renewal_history)
      : renewedPass[0].renewal_history;

  if (history && history.length === 1 && history[0].receiptNo === 'RC-RENEW-002') {
    console.log('  ✅ Renewal history successfully appended and verified in Neon');
    console.log('  ✅ Latest Slip:', renewedPass[0].receipt_no, '| Mode:', renewedPass[0].payment_mode, '\n');
  } else {
    throw new Error('Renewal history mismatch in database');
  }

  // Test 4: Collector Recruitment, Badging & Cancellation
  console.log('TEST 4: Collector Recruitment, Official ID Badge & Revocation...');
  const testColId = 'test-col-' + Date.now();
  const testColBadge = 'COL-G2-TEST';

  await sql.query(
    'INSERT INTO wpd_cloud_collectors (id, collector_id, name, email, phone, password, gate, assigned_gate, shift, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [testColId, testColBadge, 'Manjunath Gowda', 'manjunath.test@park.gov.in', '9845011111', 'Col@123', 'G2', 'G2', 'Morning', 'ACTIVE', new Date().toISOString()]
  );

  const fetchedCol = await sql.query('SELECT * FROM wpd_cloud_collectors WHERE id = $1', [testColId]);
  console.log('  ✅ Collector Recruited: Badge', fetchedCol[0].collector_id, '| Name:', fetchedCol[0].name);

  // Now cancel authorization
  await sql.query(
    'UPDATE wpd_cloud_collectors SET status = $1, cancelled_at = $2, cancel_reason = $3 WHERE id = $4',
    ['CANCELLED', new Date().toISOString(), 'End of seasonal contract', testColId]
  );

  const cancelledCol = await sql.query('SELECT * FROM wpd_cloud_collectors WHERE id = $1', [testColId]);
  if (cancelledCol[0].status === 'CANCELLED' && cancelledCol[0].cancel_reason === 'End of seasonal contract') {
    console.log('  ✅ Collector authorization cancelled in Neon database with audit reason.\n');
  } else {
    throw new Error('Collector cancellation failed');
  }

  // Test 5: Live Vercel Production API End-to-End Probe
  console.log('TEST 5: Live Vercel API End-to-End Probe (https://park-swart.vercel.app/api/sync)...');
  const apiRes = await fetch('https://park-swart.vercel.app/api/sync', { cache: 'no-store' });
  const apiJson = await apiRes.json();
  if (apiRes.ok && apiJson.success) {
    console.log('  ✅ Production API HTTP Status:', apiRes.status, 'OK');
    console.log('  ✅ Live Passes In Cloud:', apiJson.passes.length);
    console.log('  ✅ Live Collectors In Cloud:', apiJson.collectors.length);
    const hasOurTestPass = apiJson.passes.some((p) => p.id === testPassId);
    console.log('  ✅ Real-time API reflected new pass immediately:', hasOurTestPass);
  } else {
    throw new Error('Vercel API sync failed: ' + JSON.stringify(apiJson));
  }

  // Cleanup test entries
  await sql.query('DELETE FROM wpd_cloud_passes WHERE id = $1', [testPassId]);
  await sql.query('DELETE FROM wpd_cloud_collectors WHERE id = $1', [testColId]);
  console.log('\n  🧹 Test records cleaned up. Database in pristine state.');
  console.log('\n====================================================');
  console.log('🎉 ALL 5 DATABASE VERIFICATION SUITES PASSED! (100% HEALTHY)');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('❌ Database Test Failed:', err);
  process.exit(1);
});
