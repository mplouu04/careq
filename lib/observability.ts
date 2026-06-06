import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

type StructuredLog = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
};

function emit(log: StructuredLog) {
  const line = JSON.stringify(log);
  if (log.level === "error") {
    console.error(line);
  } else if (log.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  emit({ level: "info", message, timestamp: new Date().toISOString(), context });
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  emit({ level: "warn", message, timestamp: new Date().toISOString(), context });
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  emit({
    level: "error",
    message,
    timestamp: new Date().toISOString(),
    context: { ...context, stack },
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}
