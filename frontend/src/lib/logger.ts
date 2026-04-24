function isBinaryLike(value: unknown): boolean {
  return (
    value instanceof Blob ||
    value instanceof File ||
    value instanceof FormData ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

function redactValue(value: unknown): unknown {
  if (isBinaryLike(value)) {
    return "[redacted-binary]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => (isBinaryLike(item) ? "[redacted-binary]" : item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isBinaryLike(entry)
          ? "[redacted-binary]"
          : Array.isArray(entry)
            ? entry.map((item) => (isBinaryLike(item) ? "[redacted-binary]" : item))
            : entry,
      ]),
    );
  }

  return value;
}

export function log(scope: string, message: string, context?: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.info(`[${scope}] ${message}`, context ? redactValue(context) : undefined);
}
