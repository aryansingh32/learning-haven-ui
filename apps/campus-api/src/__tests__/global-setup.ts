// Build a fresh scratch database (live-schema snapshot + every migration)
// before the integration tests run.
import { execFileSync } from 'child_process';
import path from 'path';

export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/postgres';
  execFileSync('bash', [path.resolve(__dirname, '../../../api/scripts/test-db.sh'), '--prepare-only'], {
    env: { ...process.env, TEST_DATABASE_URL: url },
    stdio: 'inherit',
  });
}
