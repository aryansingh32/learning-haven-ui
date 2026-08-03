import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    smoke_100: { executor: 'constant-vus', vus: 100, duration: '1m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
  },
};

const baseUrl = __ENV.API_BASE_URL || 'http://localhost:5000';

export default function () {
  const res = http.get(`${baseUrl}/api/health`);
  check(res, {
    'health is 200': (r) => r.status === 200,
  });
  sleep(1);
}
