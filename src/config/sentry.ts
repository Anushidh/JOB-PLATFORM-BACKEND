import * as Sentry from '@sentry/node';
import env from './env';

/** Initializes Sentry error tracking (only in non-development environments or when DSN is provided) */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping error tracking');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      // Don't send operational errors (4xx) to Sentry
      if (event.extra && (event.extra as any).statusCode < 500) {
        return null;
      }
      return event;
    },
  });

  console.log('Sentry initialized');
}

export { Sentry };
