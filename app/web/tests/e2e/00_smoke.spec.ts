import { test, expect } from '@playwright/test';

test('UI loads and health ok', async ({ page, request }) => {
  await page.goto(process.env.UI_BASE ?? 'http://localhost:5173');
  await expect(page.getByText(/gov-agent-in-a-box/i)).toBeVisible();

  const res = await request.get((process.env.API_BASE ?? 'http://localhost:8000') + '/health');
  expect(res.ok()).toBeTruthy();
  const js = await res.json();
  expect(js.ok).toBeTruthy();
});
