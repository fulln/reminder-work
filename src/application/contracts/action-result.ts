export interface ActionError {
  readonly code: string;
  readonly retryable: boolean;
  readonly form?: string;
  readonly fields?: Readonly<Record<string, readonly string[]>>;
}

export type ActionResult<T> =
  | { readonly ok: true; readonly requestId: string; readonly data: T }
  | {
      readonly ok: false;
      readonly requestId: string;
      readonly error: ActionError;
    };

export function success<T>(requestId: string, data: T): ActionResult<T> {
  return { ok: true, requestId, data };
}

export function failure(
  requestId: string,
  error: ActionError,
): ActionResult<never> {
  return { ok: false, requestId, error };
}
