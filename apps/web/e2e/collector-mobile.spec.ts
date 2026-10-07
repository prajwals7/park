import { test, expect } from '@playwright/test';

test.describe('Collector Screens - Mobile Phone Viewport (390x844)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to collector home view
    await page.goto('/');
  });

  test('1. Loads mobile home screen with big search and Active/Expiring/Expired counts', async ({
    page,
  }) => {
    // Verify Mobile Viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(390);

    // Verify Collector Header & Gate Badge
    await expect(page.locator('text=Walker Pass Desk')).toBeVisible();
    await expect(page.locator('text=Gate G2 Desk')).toBeVisible();

    // Verify Metric Counts
    await expect(page.locator('text=ACTIVE')).toBeVisible();
    await expect(page.locator('text=EXPIRING')).toBeVisible();
    await expect(page.locator('text=EXPIRED')).toBeVisible();

    // Verify Big Search Input
    const searchInput = page.locator('input[placeholder="Search Name, Phone, Pass No..."]');
    await expect(searchInput).toBeVisible();

    // Big One-Handed Touch Target: + New Pass
    const newPassBtn = page.locator('button:has-text("+ New Pass")');
    await expect(newPassBtn).toBeVisible();
    const box = await newPassBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44); // WCAG Touch Target standard
  });

  test('2. Instant search filtering on mobile home screen', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search Name, Phone, Pass No..."]');

    // Search for "Rajesh"
    await searchInput.fill('Rajesh');
    await expect(page.locator('text=Rajesh Verma')).toBeVisible();
    await expect(page.locator('text=Ananya Sharma')).not.toBeVisible();

    // Search by 10-digit phone
    await searchInput.fill('9845012345');
    await expect(page.locator('text=Ananya Sharma')).toBeVisible();
    await expect(page.locator('text=Rajesh Verma')).not.toBeVisible();
  });

  test('3. Registration wizard: 12-digit Aadhaar formatting, live Verhoeff checksum & consent', async ({
    page,
  }) => {
    // Tap "+ New Pass"
    await page.locator('button:has-text("+ New Pass")').click();

    // Verify Wizard Step 1
    await expect(page.locator('text=STEP 1 OF 4: WALKER DETAILS & AADHAAR')).toBeVisible();

    // Fill Name & Phone
    await page.locator('input[placeholder="e.g. Ramesh Kumar"]').fill('Suresh Gowda');
    await page.locator('input[placeholder="9876543210"]').fill('9845112233');

    const aadhaarInput = page.locator('input[placeholder="0000 0000 0000"]');

    // Type invalid checksum Aadhaar: "367598324519"
    await aadhaarInput.fill('367598324519');
    // Verify auto 4-4-4 spacing in input value
    await expect(aadhaarInput).toHaveValue('3675 9832 4519');
    // Verify checksum error feedback
    await expect(page.locator('text=Invalid Aadhaar: Verhoeff checksum failed')).toBeVisible();

    // Type valid checksum Aadhaar: "367598324511"
    await aadhaarInput.fill('367598324511');
    await expect(aadhaarInput).toHaveValue('3675 9832 4511');
    await expect(page.locator('text=Valid Aadhaar checksum')).toBeVisible();

    // Next step button should be disabled until consent is checked
    const nextBtn = page.locator('button:has-text("Next Step")');
    await expect(nextBtn).toBeDisabled();

    // Check consent checkbox
    await page.locator('input[type="checkbox"]').check();
    await expect(nextBtn).toBeEnabled();

    // Proceed to Step 2
    await nextBtn.click();
    await expect(page.locator('text=STEP 2 OF 4: DOCUMENT CAPTURE')).toBeVisible();
  });

  test('4. Preserves registration draft in localStorage if interrupted or refreshed', async ({
    page,
  }) => {
    await page.locator('button:has-text("+ New Pass")').click();

    // Fill partial details
    await page.locator('input[placeholder="e.g. Ramesh Kumar"]').fill('Pooja Hedge');
    await page.locator('input[placeholder="9876543210"]').fill('9988776655');

    // Reload page to simulate interruption / phone lock / browser restart
    await page.reload();

    // Ensure collector returns to registration with restored draft banner
    await page.locator('button:has-text("+ New Pass")').click();
    await expect(page.locator('text=Unfinished registration draft restored.')).toBeVisible();

    // Verify restored values
    await expect(page.locator('input[placeholder="e.g. Ramesh Kumar"]')).toHaveValue('Pooja Hedge');
    await expect(page.locator('input[placeholder="9876543210"]')).toHaveValue('9988776655');

    // Discard draft
    await page.locator('button:has-text("Discard")').click();
    await expect(page.locator('input[placeholder="e.g. Ramesh Kumar"]')).toHaveValue('');
  });

  test('5. Walker profile view with masked Aadhaar and one-tap pass renewal', async ({ page }) => {
    // Select first walker on home list
    await page.locator('text=Ananya Sharma').click();

    // Verify Walker Profile
    await expect(page.locator('text=Walker Profile')).toBeVisible();
    await expect(page.locator('text=WP-1001')).toBeVisible();
    await expect(page.locator('text=Ananya Sharma')).toBeVisible();

    // Masked Aadhaar check
    await expect(page.locator('text=XXXX XXXX 1234')).toBeVisible();

    // One-Tap Renew Button
    const renewBtn = page.locator('button:has-text("One-Tap Renew Pass (₹200)")');
    await expect(renewBtn).toBeVisible();
    await renewBtn.click();

    // Verify Renew Dialog
    await expect(page.locator('text=Renew Walker Pass')).toBeVisible();

    // Fill Physical Receipt Slip Number
    const slipInput = page.locator('input[placeholder="e.g. RC-000201"]');
    await slipInput.fill('RC-000999');

    // Confirm Renewal
    await page.locator('button:has-text("Confirm Renewal")').click();

    // Verify Renewal Success State & Thermal Receipt print action
    await expect(page.locator('text=Pass Renewed for 30 Days!')).toBeVisible();
    await expect(page.locator('button:has-text("Print Thermal Receipt Slip")')).toBeVisible();
  });
});
