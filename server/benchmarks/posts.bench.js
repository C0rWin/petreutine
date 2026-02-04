import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultOptions } from './config.js';

export const options = {
  ...defaultOptions,
  thresholds: {
    'http_req_duration{name:posts}': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{name:postById}': ['p(95)<100', 'p(99)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // List posts
  const listRes = http.get(`${BASE_URL}/api/posts`, {
    tags: { name: 'posts' },
  });

  check(listRes, {
    'list status is 200': r => r.status === 200,
  });

  // Get first post by ID if available
  try {
    const posts = JSON.parse(listRes.body);
    if (Array.isArray(posts) && posts.length > 0) {
      const postId = posts[0].id;
      const getRes = http.get(`${BASE_URL}/api/posts/${postId}`, {
        tags: { name: 'postById' },
      });

      check(getRes, {
        'get status is 200': r => r.status === 200,
      });
    }
  } catch {
    // If body parsing fails, skip individual post test
  }

  sleep(0.5);
}
