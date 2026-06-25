import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

type StructuredLog = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
};

const PHI_FIELD_PATTERN =
  /^(patientName|dob|phone|email|address|reason|firstName|lastName|phoneLast7|patient_name)$/i;

function scrubValue(key: string, value: unknown): unknown {
  if (PHI_FIELD_PATTERN.test(key)) {
    return "[redacted]";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return scrubContext(value as Record<string, unknown>);
  }
  return value;
}

export function scrubContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = scrubValue(key, value);
  }
  return out;
}

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
  emit({
    level: "info",
    message,
    timestamp: new Date().toISOString(),
    context: scrubContext(context),
  });
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  emit({
    level: "warn",
    message,
    timestamp: new Date().toISOString(),
    context: scrubContext(context),
  });
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const scrubbed = scrubContext(context);
  emit({
    level: "error",
    message,
    timestamp: new Date().toISOString(),
    context: { ...scrubbed, stack },
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, { extra: scrubbed });
  }
}

export function initSentryScrubbing(): void {
  Sentry.addEventProcessor((event) => {
    if (event.extra) {
      event.extra = scrubContext(event.extra as Record<string, unknown>);
    }
    if (event.contexts) {
      for (const [key, ctx] of Object.entries(event.contexts)) {
        if (ctx && typeof ctx === "object") {
          event.contexts[key] = scrubContext(ctx as Record<string, unknown>);
        }
      }
    }
    return event;
  });
}
