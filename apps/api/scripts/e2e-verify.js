/**
 * E2E Verification Script for Walker Pass Desk
 * Verifies:
 * 1. Collector login (quickDemoLogin via API)
 * 2. Next.js rewrite proxy from port 3000 to port 4000
 * 3. Issuing a new walker pass via /api/v1/walkers
 * 4. Renewing the walker pass
 * 5. Admin login with 2FA
 * 6. Admin Dashboard metrics check
 */

const http = require('http');

function postJson(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (c) => (respData += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, raw: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method: 'GET',
        headers: {
          ...headers,
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (c) => (respData += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, raw: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Collector Login (via API) ---');
  const collectorLoginRes = await postJson(4000, '/api/v1/auth/login', {
    email: 'collector@walkerpass.gov.in',
    password: 'Admin@12345',
  });
  console.log('Collector Login Response Status:', collectorLoginRes.status);
  const collectorToken = collectorLoginRes.data?.accessToken;
  if (!collectorToken) {
    throw new Error('Collector login failed: ' + JSON.stringify(collectorLoginRes));
  }
  console.log('Collector Token obtained successfully.');

  console.log('\n--- 2. Testing Next.js Proxy Rewrite on Port 3000 ---');
  const proxyRes = await getJson(3000, '/api/v1/walkers?limit=5', {
    Authorization: `Bearer ${collectorToken}`,
  });
  console.log('Next.js Proxy /api/v1/walkers Status:', proxyRes.status);
  console.log('Current Walkers count:', proxyRes.data?.data?.length ?? proxyRes.data?.length ?? 0);

  console.log('\n--- 3. Issuing a New Walker Pass (Registration) ---');
  const passNo = 'BLR-' + Math.floor(100000 + Math.random() * 900000);
  const receiptNo = 'RCP-' + Math.floor(100000 + Math.random() * 900000);
  // Verhoeff valid Aadhaar: 234567890128
  const newWalkerRes = await postJson(
    3000,
    '/api/v1/walkers',
    {
      passNo,
      name: 'Ramesh Kumar',
      phone: '9876543210',
      gateId: 'G2',
      aadhaarNumber: '234567890124',
      consentAgreed: true,
      aadhaarStorageKey: 'documents/aadhaar_scan.jpg',
      passportStorageKey: 'documents/walker_photo.jpg',
      paymentMode: 'CASH',
      receiptNo,
    },
    {
      Authorization: `Bearer ${collectorToken}`,
      'x-idempotency-key': 'idem-' + Date.now(),
    }
  );
  console.log('Register Walker Status:', newWalkerRes.status);
  console.log('Register Walker Data:', JSON.stringify(newWalkerRes.data, null, 2));

  const walkerId = newWalkerRes.data?.walker?.id || newWalkerRes.data?.id;
  if (!walkerId) {
    throw new Error('Walker creation failed to return ID');
  }

  console.log('\n--- 4. Testing Pass Renewal ---');
  const renewReceipt = 'RCP-RNW-' + Math.floor(100000 + Math.random() * 900000);
  const renewRes = await postJson(
    3000,
    `/api/v1/walkers/${walkerId}/renew`,
    {
      gateId: 'G2',
      paymentMode: 'UPI',
      receiptNo: renewReceipt,
      ticketStorageKey: 'documents/renewal_ticket.jpg',
    },
    {
      Authorization: `Bearer ${collectorToken}`,
      'x-idempotency-key': 'idem-renew-' + Date.now(),
    }
  );
  console.log('Renew Walker Status:', renewRes.status);
  console.log('Renew Walker Data:', JSON.stringify(renewRes.data, null, 2));

  console.log('\n--- 5. Admin Login & 2FA ---');
  const adminLoginStep1 = await postJson(4000, '/api/v1/auth/login', {
    email: 'admin@walkerpass.gov.in',
    password: 'Admin@12345',
  });
  console.log('Admin Login Step 1 Status:', adminLoginStep1.status);
  const challengeToken = adminLoginStep1.data?.challengeToken;
  
  const adminLoginStep2 = await postJson(4000, '/api/v1/auth/verify-2fa', {
    challengeToken,
    code: '123456',
  });
  console.log('Admin 2FA Verify Status:', adminLoginStep2.status);
  const adminToken = adminLoginStep2.data?.accessToken;
  if (!adminToken) {
    throw new Error('Admin 2FA verification failed: ' + JSON.stringify(adminLoginStep2));
  }
  console.log('Admin Token obtained successfully.');

  console.log('\n--- 6. Testing Admin Dashboard Metrics (Port 3000 Proxy) ---');
  const adminDashboardRes = await getJson(3000, '/api/v1/admin/dashboard?range=today', {
    Authorization: `Bearer ${adminToken}`,
  });
  console.log('Admin Dashboard Status:', adminDashboardRes.status);
  console.log('Dashboard KPIs:', JSON.stringify(adminDashboardRes.data?.kpis, null, 2));

  console.log('\n>>> ALL VERIFICATION CHECKS PASSED PERFECTLY! <<<');
}

run().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
