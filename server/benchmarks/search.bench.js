import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultOptions } from './config.js';

export const options = {
  ...defaultOptions,
  thresholds: {
    'http_req_duration{name:search}': ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const queries = ['собака', 'кошка', 'потерялся', ''];
const types = ['lost', 'found', ''];
const animalTypes = ['dog', 'cat', ''];

export default function () {
  const query = queries[Math.floor(Math.random() * queries.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  const animalType = animalTypes[Math.floor(Math.random() * animalTypes.length)];

  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (type) params.append('type', type);
  if (animalType) params.append('animal_type', animalType);

  const url = `${BASE_URL}/api/search${params.toString() ? '?' + params.toString() : ''}`;

  const res = http.get(url, {
    tags: { name: 'search' },
  });

  check(res, {
    'status is 200': r => r.status === 200,
    'has posts array': r => {
      try {
        return JSON.parse(r.body).posts !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(0.5);
}
