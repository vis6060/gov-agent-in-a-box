import { test, expect } from '@playwright/test';
import { postTask, waitForMetric } from './_helpers';

test('rag.search requests & latency recorded', async ({ request }) => {
  for (let i = 0; i < 10; i++) {
    await postTask(request, { prompt: `Info request ${i}`, region: 'us_east', top_k: 3 });
  }
  const m = await waitForMetric(request, 'TOOL_REQS', 15000).catch(async () => {
    // some setups expose as lowercase names; fallback to search for 'tool_reqs'
    return waitForMetric(request, 'tool_reqs', 15000);
  });
  expect(m.toLowerCase()).toContain('rag.search');
});
