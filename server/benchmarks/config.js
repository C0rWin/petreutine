export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const defaultOptions = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp up
    { duration: '30s', target: 10 }, // Steady state
    { duration: '5s', target: 0 }, // Ramp down
  ],
};
