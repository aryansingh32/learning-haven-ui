import { NextFunction, Request, Response } from 'express';

type RouteStats = {
  count: number;
  errors: number;
  durations: number[];
};

const routeStats = new Map<string, RouteStats>();
const startedAt = Date.now();

function routeKey(req: Request) {
  const path = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
  return `${req.method} ${path}`;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const key = routeKey(req);
    const stats = routeStats.get(key) || { count: 0, errors: 0, durations: [] };
    stats.count += 1;
    if (res.statusCode >= 500) stats.errors += 1;
    stats.durations.push(durationMs);
    if (stats.durations.length > 1_000) stats.durations.shift();
    routeStats.set(key, stats);
  });
  next();
}

function label(route: string) {
  return route.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function renderPrometheusMetrics() {
  const lines = [
    '# HELP learning_haven_process_uptime_seconds Process uptime in seconds.',
    '# TYPE learning_haven_process_uptime_seconds gauge',
    `learning_haven_process_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
    '# HELP learning_haven_http_requests_total Total HTTP requests by route.',
    '# TYPE learning_haven_http_requests_total counter',
    '# HELP learning_haven_http_errors_total Total 5xx HTTP responses by route.',
    '# TYPE learning_haven_http_errors_total counter',
    '# HELP learning_haven_http_latency_ms HTTP latency percentiles by route.',
    '# TYPE learning_haven_http_latency_ms gauge',
  ];

  for (const [route, stats] of routeStats.entries()) {
    const routeLabel = label(route);
    lines.push(`learning_haven_http_requests_total{route="${routeLabel}"} ${stats.count}`);
    lines.push(`learning_haven_http_errors_total{route="${routeLabel}"} ${stats.errors}`);
    lines.push(`learning_haven_http_latency_ms{route="${routeLabel}",quantile="0.50"} ${percentile(stats.durations, 50).toFixed(2)}`);
    lines.push(`learning_haven_http_latency_ms{route="${routeLabel}",quantile="0.95"} ${percentile(stats.durations, 95).toFixed(2)}`);
    lines.push(`learning_haven_http_latency_ms{route="${routeLabel}",quantile="0.99"} ${percentile(stats.durations, 99).toFixed(2)}`);
  }

  return `${lines.join('\n')}\n`;
}
