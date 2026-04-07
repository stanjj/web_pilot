/**
 * @module output
 * Opt-in structured output helpers for --json mode.
 * Default CLI output remains unchanged — these helpers are only
 * used when the caller explicitly wraps execution in JSON mode.
 */

/**
 * Build a success envelope for machine-readable output.
 * @param {unknown} data - The command's result payload.
 * @param {Record<string, unknown>} [meta] - Optional metadata (e.g. elapsedMs).
 * @returns {{ ok: true, data: unknown, meta?: Record<string, unknown> }}
 */
export function toSuccess(data, meta) {
  const envelope = { ok: true, data };
  if (meta && Object.keys(meta).length > 0) {
    envelope.meta = meta;
  }
  return envelope;
}

/**
 * Build a failure envelope for machine-readable output.
 * @param {unknown} err - The error (Error instance or any value).
 * @returns {{ ok: false, error: string, code: string, hint?: string, details?: unknown }}
 */
export function toFailure(err) {
  if (err && typeof err === "object" && "ok" in err && err.ok === false) {
    return err;
  }
  const envelope = {
    ok: false,
    error: err instanceof Error ? err.message : String(err),
    code: err?.code ?? "UNKNOWN_ERROR",
  };
  if (err?.hint) envelope.hint = err.hint;
  if (err?.details !== undefined) envelope.details = err.details;
  return envelope;
}
