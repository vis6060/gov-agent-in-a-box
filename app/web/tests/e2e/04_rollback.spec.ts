import { test, expect } from '@playwright/test';
import { postTask } from './_helpers';

test('rollback within 60s succeeds', async ({ request }) => {
  const { js } = await postTask(request, {
    prompt: 'Email: a.user@example.com — where do I appeal?',
    region: 'us_east', top_k: 3
  });
  expect(js.status).toBe('ok');
  expect(js.pre_action).toBe('allow_with_redaction');

  const trace = js.trace_id;
  const res2 = await request.post((process.env.API_BASE ?? 'http://localhost:8000') + `/trace/rollback/${trace}?within=60`);
  expect(res2.ok()).toBeTruthy();
  const out = await res2.json();
  expect(out.ok).toBeTruthy();
});
