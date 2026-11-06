import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Setup Mock Window and LocalStorage for Vitest Node environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, value);
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
};

beforeAll(() => {
  // @ts-expect-error mock window for Node test runner
  global.window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  global.localStorage = mockLocalStorage as unknown as Storage;
});

import {
  saveRecordedPass,
  getRecordedPasses,
  renewRecordedPass,
  clearAllRecordedPasses,
  saveRecruitedCollector,
  getRecruitedCollectors,
  cancelRecruitedCollector,
  generateCollectorId,
  evaluateReportsAndReconciliation,
  getGateShiftSummary,
  getNextSuggestedPassAndReceipt,
} from '../lib/pass-store';

describe('End-to-End Pass Lifecycle, Photos & Collector Management Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('1. Admin Collector Recruitment & ID Badging', () => {
    it('generates official Collector ID with designated gate prefix', () => {
      const idG2 = generateCollectorId('G2');
      expect(idG2).toMatch(/^COL-G2-\d{4}$/);

      const idGS = generateCollectorId('GS');
      expect(idGS).toMatch(/^COL-GS-\d{4}$/);

      const idG9 = generateCollectorId('G9');
      expect(idG9).toMatch(/^COL-G9-\d{4}$/);
    });

    it('recruits new collector, saves assigned gate, shift, credentials and issues ID', () => {
      const collector = saveRecruitedCollector({
        name: 'Ramesh Patel',
        email: 'ramesh.g2@park.gov.in',
        phone: '9845012345',
        password: 'Collector@123',
        gate: 'G2',
        shift: 'MORNING',
      });

      expect(collector.id).toBeDefined();
      expect(collector.name).toBe('Ramesh Patel');
      expect(collector.collectorId).toMatch(/^COL-G2-\d{4}$/);
      expect(collector.status).toBe('ACTIVE');
      expect(collector.gate).toBe('G2');
      expect(collector.shift).toBe('MORNING');

      // Verify persistence in store
      const allCollectors = getRecruitedCollectors();
      const found = allCollectors.find((c) => c.email === 'ramesh.g2@park.gov.in');
      expect(found).toBeDefined();
      expect(found?.collectorId).toBe(collector.collectorId);
    });

    it('allows Admin to cancel / revoke collector authorization with recorded reason', () => {
      const collector = saveRecruitedCollector({
        name: 'Suresh Kumar',
        email: 'suresh.gs@park.gov.in',
        phone: '9845099999',
        gate: 'GS',
        shift: 'GENERAL',
      });

      const cancelled = cancelRecruitedCollector(collector.id, 'Duty concluded / Shift rotation');
      expect(cancelled).not.toBeNull();
      expect(cancelled?.status).toBe('CANCELLED');
      expect(cancelled?.cancelReason).toBe('Duty concluded / Shift rotation');
      expect(cancelled?.cancelledAt).toBeDefined();

      // Ensure cancelled status is persisted
      const allCollectors = getRecruitedCollectors();
      const check = allCollectors.find((c) => c.id === collector.id);
      expect(check?.status).toBe('CANCELLED');
    });
  });

  describe('2. Pass Issuance & Photo Document Database Storage', () => {
    it('stores walker passport photo, Aadhaar document photo, and receipt slip photo', () => {
      const mockWalkerPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_walker_photo';
      const mockAadhaarPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_aadhaar_doc';
      const mockReceiptPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_receipt_slip';

      const pass = saveRecordedPass({
        passNo: 'WP-000101',
        name: 'Anita Deshmukh',
        phone: '9845077777',
        gateId: 'G2',
        receiptNo: 'RC-000101',
        amountPaise: 20000,
        paymentMode: 'CASH',
        rawAadhaar: '367598324511',
        walkerPhotoUrl: mockWalkerPhoto,
        aadhaarPhotoUrl: mockAadhaarPhoto,
        receiptPhotoUrl: mockReceiptPhoto,
      });

      expect(pass.id).toBeDefined();
      expect(pass.passNo).toBe('WP-000101');
      expect(pass.status).toBe('ACTIVE');
      expect(pass.maskedAadhaar).toBe('XXXX XXXX 4511');
      expect(pass.walkerPhotoUrl).toBe(mockWalkerPhoto);
      expect(pass.aadhaarPhotoUrl).toBe(mockAadhaarPhoto);
      expect(pass.receiptPhotoUrl).toBe(mockReceiptPhoto);

      // Verify retrieval from store
      const passes = getRecordedPasses();
      const retrieved = passes.find((p) => p.passNo === 'WP-000101');
      expect(retrieved).toBeDefined();
      expect(retrieved?.walkerPhotoUrl).toBe(mockWalkerPhoto);
      expect(retrieved?.aadhaarPhotoUrl).toBe(mockAadhaarPhoto);
      expect(retrieved?.receiptPhotoUrl).toBe(mockReceiptPhoto);
    });

    it('auto-suggests next sequential pass and receipt numbers', () => {
      saveRecordedPass({
        passNo: 'WP-000105',
        name: 'Kiran Rao',
        phone: '9845088888',
        gateId: 'G2',
        receiptNo: 'RC-000105',
        amountPaise: 20000,
        paymentMode: 'UPI',
      });

      const suggestion = getNextSuggestedPassAndReceipt();
      expect(suggestion.passNo).toBe('WP-000106');
      expect(suggestion.receiptNo).toBe('RC-000106');
    });
  });

  describe('3. Pass Renewal & Receipt Photo Storage in History', () => {
    it('renews pass, extends validity by 30 days, stores renewal receipt photo in renewalHistory', () => {
      const pass = saveRecordedPass({
        passNo: 'WP-000110',
        name: 'Venkatesh Prasad',
        phone: '9845033333',
        gateId: 'G2',
        receiptNo: 'RC-000110',
        amountPaise: 20000,
        paymentMode: 'CASH',
      });

      const renewalReceiptPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_renewal_receipt_photo';

      const renewed = renewRecordedPass(pass.id, {
        receiptNo: 'RC-000125',
        paymentMode: 'UPI',
        gateId: 'G2',
        receiptPhotoUrl: renewalReceiptPhoto,
      });

      expect(renewed).not.toBeNull();
      expect(renewed?.receiptNo).toBe('RC-000125');
      expect(renewed?.paymentMode).toBe('UPI');
      expect(renewed?.status).toBe('ACTIVE');
      expect(renewed?.receiptPhotoUrl).toBe(renewalReceiptPhoto);

      // Verify renewal history contains the record with receipt photo
      expect(renewed?.renewalHistory).toBeDefined();
      expect(renewed?.renewalHistory?.length).toBeGreaterThanOrEqual(1);

      const latestRenewal = renewed?.renewalHistory?.[0];
      expect(latestRenewal?.receiptNo).toBe('RC-000125');
      expect(latestRenewal?.receiptPhotoUrl).toBe(renewalReceiptPhoto);
      expect(latestRenewal?.paymentMode).toBe('UPI');
      expect(latestRenewal?.amountPaise).toBe(20000);
    });
  });

  describe('4. Financial Reconciliation & Gate Shift Calculations', () => {
    it('evaluates cash vs UPI collections and gate breakdown accurately', () => {
      clearAllRecordedPasses();

      // Pass 1: G2, Cash Rs 200
      saveRecordedPass({
        passNo: 'WP-000201',
        name: 'Walker One',
        phone: '9845000001',
        gateId: 'G2',
        receiptNo: 'RC-000201',
        amountPaise: 20000,
        paymentMode: 'CASH',
      });

      // Pass 2: G2, UPI Rs 200
      saveRecordedPass({
        passNo: 'WP-000202',
        name: 'Walker Two',
        phone: '9845000002',
        gateId: 'G2',
        receiptNo: 'RC-000202',
        amountPaise: 20000,
        paymentMode: 'UPI',
      });

      // Pass 3: GS, Cash Rs 200
      saveRecordedPass({
        passNo: 'WP-000203',
        name: 'Walker Three',
        phone: '9845000003',
        gateId: 'GS',
        receiptNo: 'RC-000203',
        amountPaise: 20000,
        paymentMode: 'CASH',
      });

      const report = evaluateReportsAndReconciliation();
      expect(report.totalPassesCount).toBe(3);
      expect(report.totalCollectedInr).toBe(600); // 3 x Rs 200
      expect(report.cashInr).toBe(400); // 2 cash = 400
      expect(report.cashCount).toBe(2);
      expect(report.upiInr).toBe(200); // 1 UPI = 200
      expect(report.upiCount).toBe(1);

      // Gate G2 breakdown: 2 passes (1 cash, 1 upi)
      expect(report.gateBreakdown['G2'].passes).toBe(2);
      expect(report.gateBreakdown['G2'].cashInr).toBe(200);
      expect(report.gateBreakdown['G2'].upiInr).toBe(200);
      expect(report.gateBreakdown['G2'].totalInr).toBe(400);

      // Gate GS breakdown: 1 pass (1 cash)
      expect(report.gateBreakdown['GS'].passes).toBe(1);
      expect(report.gateBreakdown['GS'].cashInr).toBe(200);
      expect(report.gateBreakdown['GS'].totalInr).toBe(200);

      // Gate shift summary for G2
      const shiftG2 = getGateShiftSummary('G2');
      expect(shiftG2.totalPassesToday).toBe(2);
      expect(shiftG2.cashAmountInr).toBe(200);
      expect(shiftG2.upiAmountInr).toBe(200);
      expect(shiftG2.totalRevenueInr).toBe(400);
    });
  });
});
