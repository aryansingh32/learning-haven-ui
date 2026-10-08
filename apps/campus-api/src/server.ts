import { env } from './env';
import { app } from './app';
import { pool } from './db';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

const server = app.listen(env.PORT, () => {
  console.log(`Forge Campus API listening on port ${env.PORT}`);
});

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
