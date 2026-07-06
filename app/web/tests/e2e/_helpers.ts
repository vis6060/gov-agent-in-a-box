import { APIRequestContext, Page } from '@playwright/test';

// UI helper: submit via the page
export async function submitViaUI(page: Page, prompt: string, region = 'us_east') {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const regionSelect = page.locator('select');
  if (await regionSelect.isVisible()) {
    await regionSelect.selectOption(region);
  }

  await page.locator('textarea').fill(prompt);

  // Accept the alert the app shows after submission
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: /submit task/i }).click();

  // let the queue refresh
  await page.waitForTimeout(800);
}

// POST /v1/tasks using an absolute API URL
export async function postTask(api: APIRequestContext, body: any, headers?: Record<string, string>) {
  const apiBase = process.env.API_BASE ?? 'http://localhost:8000';
  const res = await api.post(`${apiBase}/v1/tasks`, {
    data: body,
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) }
  });
  const js = await res.json();
  return { status: res.status(), js };
}

// Poll /metrics until a family name appears
export async function waitForMetric(api: APIRequestContext, nameContains: string, timeoutMs = 10_000) {
  const apiBase = process.env.API_BASE ?? 'http://localhost:8000';
  const end = Date.now() + timeoutMs;

  while (Date.now() < end) {
    const res = await api.get(`${apiBase}/metrics`);
    const text = await res.text();
    if (text.toLowerCase().includes(nameContains.toLowerCase())) return text;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Metric ${nameContains} not found in /metrics within ${timeoutMs}ms`);
}

// Tiny parser to read a counter value from the metrics text
export function valueOfCounter(metricsText: string, family: string, labelsFilter?: string) {
  const lines = metricsText.split('\n').filter(l => l.startsWith(family));
  const line = labelsFilter ? lines.find(l => l.includes(labelsFilter)) : lines[0];
  if (!line) return 0;
  const parts = line.trim().split(/\s+/);
  const num = parseFloat(parts[parts.length - 1]);
  return Number.isFinite(num) ? num : 0;
}
