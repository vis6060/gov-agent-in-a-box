import { test, expect } from '@playwright/test';
import { postTask, waitForMetric, valueOfCounter } from './_helpers';

test('cache miss then hits', async ({ request }) => {
  const API = process.env.API_BASE ?? 'http://localhost:8000';
  const body = { prompt: 'Repeat me: a.user@example.com', region: 'us_east', top_k: 3 };

  // warm miss
  await postTask(request, body);

  // generate hits (same prompt)
  for (let i = 0; i < 40; i++) {
    await postTask(request, body);
  }

  const text = await waitForMetric(request, 'cache_hits_total', 15000);
  const hits = valueOfCounter(text, 'cache_hits_total', '{region="us_east"}');
  const misses = valueOfCounter(text, 'cache_misses_total', '{region="us_east"}');

  expect(hits).toBeGreaterThan(0);
  expect(misses).toBeGreaterThan(0);
});
