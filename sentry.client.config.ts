import * as Sentry from "@sentry/nextjs";
import { initSentryScrubbing } from "@/lib/observability";

initSentryScrubbing();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
});
