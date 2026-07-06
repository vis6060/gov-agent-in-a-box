import { test, expect } from '@playwright/test';
import { waitForMetric } from './_helpers';

test('common metric families present', async ({ request }) => {
  const m = await waitForMetric(request, 'http', 15000); // dump`
  const all = await request.get((process.env.API_BASE ?? 'http://localhost:8000') + '/metrics').then(r=>r.text());
  expect(all).toContain('api_requests_total'); // or REQS equivalent if you export it as such
  expect(all).toContain('policy_decisions_total');
  expect(all.toLowerCase()).toContain('tool_reqs'); // rag.search
  expect(all).toContain('cache_hits_total');
  expect(all).toContain('cache_misses_total');
});
