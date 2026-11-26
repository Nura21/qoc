import { expect, test } from '@playwright/test';

test('visits dashboard and displays KPI card', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-content')).toContainText('Tagihan Belum Dibayar');
});
