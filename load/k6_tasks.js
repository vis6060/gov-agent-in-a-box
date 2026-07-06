import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: 30,             // target RPS
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],        // <1% errors
    http_req_duration: ['p(95)<150'],      // p95 < 150ms
  },
};

export default function () {
  const url = 'http://localhost:8000/v1/tasks';
  const payload = JSON.stringify({
    prompt: 'How long do I have to appeal benefits?',
    region: 'us_east',
    top_k: 3
  });
  const params = { headers: { 'Content-Type': 'application/json', 'X-Actor': 'op@local' } };
  const res = http.post(url, payload, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.1);
}
