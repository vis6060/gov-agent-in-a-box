import { test } from '@playwright/test';
import { postTask, waitForMetric } from './_helpers';

test('quota reject (optional)', async ({ request }) => {
  // Attempt with X-Force-Quota header (your API may ignore this; then we skip)
  const { status, js } = await postTask(request, {
    prompt: 'Quota test prompt',
    region: 'us_east', top_k: 1
  }, { 'X-Force-Quota': '1', 'X-Actor': 'quota_test' });

  if (status >= 400 || js?.status === 'blocked' || (js?.reasons ?? []).some((r:string)=>/quota/i.test(r))) {
    // Expect the metric to show up
    await waitForMetric(request, 'quota_rejects_total', 15000);
  } else {
    test.info().annotations.push({ type: 'skip', description: 'API did not support forced quota; skipping metric check' });
    test.skip();
  }
});
