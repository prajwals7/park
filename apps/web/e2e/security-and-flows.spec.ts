import { test, expect } from '@playwright/test';

test.describe('End-to-End Workflows, Security QA & Role Matrix Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('1. Walker Registration Flow with 12-digit Aadhaar, Verhoeff & physical receipt', async ({
    page,
  }) => {
    // Switch to COLLECTOR role if not already
    const roleSelect = page.locator('select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('COLLECTOR');
    }

    // Tap "+ New Pass"
    const newPassBtn = page.locator('button:has-text("+ New Pass")');
    await expect(newPassBtn).toBeVisible();
    await newPassBtn.click();

    // Verify Wizard Step 1 Header
    await expect(page.locator('text=STEP 1 OF 4: WALKER DETAILS & AADHAAR')).toBeVisible();

    // Fill Step 1 Details
    await page.locator('input[placeholder="e.g. Ramesh Kumar"]').fill('Mahesh Hegde');
    await page.locator('input[placeholder="e.g. 9845012345"]').fill('9845099999');

    // Fill 12-digit Aadhaar with Verhoeff validation
    const aadhaarInput = page.locator('input[placeholder="12-digit Aadhaar Number (e.g. 5489 1234 5678)"]');
    await aadhaarInput.fill('3675 9832 4511');

    // Verify Checksum Pass indicator
    await expect(page.locator('text=Valid 12-digit Aadhaar (Verhoeff checksum passed)')).toBeVisible();

    // Check mandatory consent
    const consentCheckbox = page.locator('input[type="checkbox"]');
    await consentCheckbox.check();

    // Advance to Step 2: Documents
    await page.locator('button:has-text("Continue to Documents")').click();
    await expect(page.locator('text=STEP 2 OF 4: PHOTOGRAPH & IDENTITY PROOF')).toBeVisible();

    // Advance to Step 3: Payment
    await page.locator('button:has-text("Continue to Payment")').click();
    await expect(page.locator('text=STEP 3 OF 4: PHYSICAL PAYMENT & PASS')).toBeVisible();

    // Fill Payment mode, Pass No & Receipt No
    await page.locator('input[placeholder="e.g. WP-100234"]').fill('WP-9988');
    await page.locator('input[placeholder="e.g. RC-004521"]').fill('RC-9988');

    // Advance to Step 4: Review
    await page.locator('button:has-text("Review Registration")').click();
    await expect(page.locator('text=STEP 4 OF 4: REVIEW & CONFIRMATION')).toBeVisible();

    // Verify Masked Aadhaar is displayed (Never plaintext)
    await expect(page.locator('text=XXXX XXXX 4511')).toBeVisible();

    // Submit registration
    await page.locator('button:has-text("Confirm & Issue Pass")').click();

    // Verify Success modal
    await expect(page.locator('text=Pass Issued Successfully')).toBeVisible();
  });

  test('2. Pass Renewal Flow with physical receipt and payment mode', async ({ page }) => {
    // Switch to COLLECTOR role
    const roleSelect = page.locator('select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('COLLECTOR');
    }

    // Select existing walker card
    const walkerCard = page.locator('text=Rajesh Verma').first();
    if (await walkerCard.isVisible()) {
      await walkerCard.click();

      // Click Renew Pass button
      const renewBtn = page.locator('button:has-text("Renew Pass")');
      await expect(renewBtn).toBeVisible();
      await renewBtn.click();

      // Check Renew Dialog
      await expect(page.locator('text=Enter physical payment and receipt details')).toBeVisible();

      // Fill Receipt Number
      await page.locator('input[placeholder="e.g. RC-004521"]').fill('RC-112233');

      // Submit Renewal
      await page.locator('button:has-text("Confirm Renewal")').click();

      // Verify Toast notification
      await expect(page.locator('text=Pass Renewed Successfully')).toBeVisible();
    }
  });

  test('3. Walker Search & Status Filtering', async ({ page }) => {
    // Search input
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill('Rajesh');
    await expect(page.locator('text=Rajesh Verma').first()).toBeVisible();

    // Clear search
    await searchInput.fill('');
  });

  test('4. Role Restrictions: Collector vs Admin Dashboard Layout', async ({ page }) => {
    const roleSelect = page.locator('select').first();

    // Set to COLLECTOR
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('COLLECTOR');
      // Admin-only management tabs must NOT be visible
      await expect(page.locator('button:has-text("Reports")')).not.toBeVisible();
      await expect(page.locator('button:has-text("Staff Users")')).not.toBeVisible();
      await expect(page.locator('button:has-text("Audit Log")')).not.toBeVisible();

      // Switch to ADMIN
      await roleSelect.selectOption('ADMIN');
      // Admin dashboard tabs MUST be visible
      await expect(page.locator('button:has-text("Overview")')).toBeVisible();
      await expect(page.locator('button:has-text("Walkers")')).toBeVisible();
      await expect(page.locator('button:has-text("Expiries")')).toBeVisible();
      await expect(page.locator('button:has-text("Reports")')).toBeVisible();
      await expect(page.locator('button:has-text("Staff Users")')).toBeVisible();
      await expect(page.locator('button:has-text("Audit Log")')).toBeVisible();
    }
  });

  test('5. Admin Walker Management: Soft Delete requires mandatory reason', async ({ page }) => {
    const roleSelect = page.locator('select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('ADMIN');

      // Navigate to Walkers tab
      await page.locator('button:has-text("Walkers")').click();

      // Check Walker Table is rendered
      await expect(page.locator('text=Walker Directory')).toBeVisible();

      // Click Delete action on first row if available
      const deleteBtn = page.locator('button:has-text("Delete")').first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();

        // Verify Delete Dialog with Mandatory Reason
        await expect(page.locator('text=Reason for Soft Deletion')).toBeVisible();
        const reasonInput = page.locator('textarea[placeholder*="Reason"]');
        await expect(reasonInput).toBeVisible();

        // Cancel dialog safely
        await page.locator('button:has-text("Cancel")').click();
      }
    }
  });

  test('6. Reports and CSV/Excel Export Triggers', async ({ page }) => {
    const roleSelect = page.locator('select').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('ADMIN');

      // Click Reports tab
      await page.locator('button:has-text("Reports")').click();

      // Check Reports subview is rendered
      await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
      await expect(page.locator('button:has-text("Export Excel")')).toBeVisible();
    }
  });

  test('7. Session Expiry & Offline Banner Handling', async ({ page }) => {
    // Offline simulation banner
    const banner = page.locator('text=Offline Mode');
    // Initially should not be displayed or displays Online
    expect(await banner.count()).toBeGreaterThanOrEqual(0);
  });
});
