# Performance Benchmarks

k6 load test scripts for measuring endpoint performance.

## Prerequisites

- k6 installed: `brew install k6` (macOS) or [k6.io/docs/getting-started/installation](https://k6.io/docs/getting-started/installation/)
- Server running with database connection

## Running Benchmarks

Start the server first:

```bash
cd server && npm run dev
```

In another terminal, run benchmarks:

```bash
# Search endpoint
k6 run server/benchmarks/search.bench.js --env BASE_URL=http://localhost:3001

# Posts endpoint
k6 run server/benchmarks/posts.bench.js --env BASE_URL=http://localhost:3001
```

## Thresholds

Thresholds are defined in `thresholds.json` and enforced in each benchmark script.

| Metric    | Description                                         |
| --------- | --------------------------------------------------- |
| p50       | 50% of requests complete under this time (ms)       |
| p95       | 95% of requests - baseline for "normal" performance |
| p99       | 99% of requests - catches outliers                  |
| errorRate | Maximum acceptable error rate (0.01 = 1%)           |

### Current Thresholds

| Endpoint       | p50   | p95   | p99    | Error Rate |
| -------------- | ----- | ----- | ------ | ---------- |
| /api/search    | 100ms | 500ms | 1000ms | 1%         |
| /api/posts     | 50ms  | 200ms | 500ms  | 1%         |
| /api/posts/:id | 30ms  | 100ms | 300ms  | 1%         |

## Updating Thresholds

1. Run baseline benchmarks on clean system
2. Update `thresholds.json` with ~10% margin above baseline
3. Commit changes

## Load Profile

Default stages (45s total):

- 10s: Ramp up to 10 VUs
- 30s: Steady state at 10 VUs
- 5s: Ramp down to 0

Modify `config.js` to adjust.
