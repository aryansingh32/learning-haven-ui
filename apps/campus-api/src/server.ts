import { env } from './env';
import { app } from './app';
import { pool } from './db';
import { runScheduler } from './services/notify';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

const server = app.listen(env.PORT, () => {
  console.log(`Forge Campus API listening on port ${env.PORT}`);
});

// Optional in-process scheduler (one server instance only; otherwise use the cron endpoint).
if (env.SCHEDULER_MINUTES) {
  const timer = setInterval(() => {
    runScheduler().catch((err) => console.error('Scheduler run failed:', err instanceof Error ? err.message : err));
  }, env.SCHEDULER_MINUTES * 60_000);
  timer.unref();
}

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
