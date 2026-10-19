export type CoreErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED'
  | 'UNAVAILABLE'
  | 'INVALID_TRANSITION';

export class CoreError extends Error {
  readonly code: CoreErrorCode;

  constructor(code: CoreErrorCode, message: string) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
  }
}

/** Operation result that never carries a fabricated success value. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: CoreError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: CoreErrorCode, message: string): Result<T> {
  return { ok: false, error: new CoreError(code, message) };
}

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}
