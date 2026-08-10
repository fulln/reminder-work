const allowed = new Set([
  "operation",
  "outcome",
  "code",
  "requestId",
  "traceId",
  "reminderId",
  "attempt",
]);

export interface SafeLogger {
  info(fields: Readonly<Record<string, unknown>>): void;
  error(fields: Readonly<Record<string, unknown>>): void;
}

export class RedactedLogger implements SafeLogger {
  constructor(private readonly write: (line: string) => void = console.log) {}

  info(fields: Readonly<Record<string, unknown>>): void {
    this.emit("info", fields);
  }

  error(fields: Readonly<Record<string, unknown>>): void {
    this.emit("error", fields);
  }

  private emit(
    level: "info" | "error",
    fields: Readonly<Record<string, unknown>>,
  ): void {
    this.write(
      JSON.stringify({
        level,
        ...Object.fromEntries(
          Object.entries(fields).filter(([key]) => allowed.has(key)),
        ),
      }),
    );
  }
}
