import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { getAppSecret } from './lib/app-secret';

export async function register() {
  // Deployment secrets are required at runtime, not while building the image.
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
    getAppSecret();
  }

  // Pulse: start the built-in scheduler in the production Node server
  // (alerts, scheduled reports, uptime checks, retention cleanup). It is
  // lease-guarded in the database, so multiple instances do not double-run.
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD &&
    process.env.NODE_ENV === 'production'
  ) {
    const { startScheduler } = await import('./lib/pulse/scheduler');
    startScheduler();
  }
}
