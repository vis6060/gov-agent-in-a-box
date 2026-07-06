import { test } from '@playwright/test';
import { submitViaUI, waitForMetric } from './_helpers';

test('redaction + block populate metrics and queue', async ({ page, request }) => {
  await submitViaUI(page, 'My email is a.user@example.com. Please help.', 'us_east');
  await submitViaUI(page, 'SSN is 000-12-3456. What next?', 'us_east');

  await waitForMetric(request, 'policy_decisions_total', 15000);
});
