import { test, expect } from '@playwright/test';

test.describe('Album Grid E2E Tests', () => {
  test('renders homepage and verifies no console or image 400 errors occur', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedImageUrls: string[] = [];

    // Listen for uncaught console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for 400/500 image optimization failures
    page.on('response', (response) => {
      if (response.url().includes('/_next/image') && response.status() >= 400) {
        failedImageUrls.push(`${response.status()} - ${response.url()}`);
      }
    });

    await page.goto('/');

    // Verify main page elements render
    await expect(page.locator('h1')).toBeVisible();

    // Verify no service worker ReferenceError or image 400 errors occurred
    const refErrors = consoleErrors.filter((err) => err.includes('_ref is not defined'));
    expect(refErrors, 'Service Worker should not throw _ref ReferenceError').toEqual([]);
    expect(failedImageUrls, 'No Next.js image proxy 400 errors should occur').toEqual([]);
  });
});
