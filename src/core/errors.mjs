/**
 * @typedef {Object} ErrorEnvelope
 * @property {false} ok
 * @property {string} error
 * @property {string} code
 * @property {string} [hint]
 * @property {unknown} [details]
 */

/** Stable exit codes for CLI. */
export const EXIT_CODES = {
  OK: 0,
  GENERAL: 1,
  USAGE: 2,
  CDP_CONNECTION: 3,
  NAVIGATION: 4,
  PARSE: 5,
  VALIDATION: 6,
  UNSUPPORTED: 7,
  TIMEOUT: 8,
};

export class CliError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {{ hint?: string, details?: unknown, exitCode?: number }} [options]
   */
  constructor(message, code, options = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = options.hint;
    this.details = options.details;
    this.exitCode = options.exitCode ?? EXIT_CODES.GENERAL;
  }
}

export class ValidationError extends CliError {
  constructor(message, options = {}) {
    super(message, "VALIDATION_ERROR", { exitCode: EXIT_CODES.VALIDATION, ...options });
    this.name = "ValidationError";
  }
}

export class CdpConnectionError extends CliError {
  constructor(message, options = {}) {
    super(message, "CDP_CONNECTION_ERROR", {
      exitCode: EXIT_CODES.CDP_CONNECTION,
      hint: "Is the browser running? Try: node src/cli.mjs browser ensure",
      ...options,
    });
    this.name = "CdpConnectionError";
  }
}

export class NavigationError extends CliError {
  constructor(message, options = {}) {
    super(message, "NAVIGATION_ERROR", { exitCode: EXIT_CODES.NAVIGATION, ...options });
    this.name = "NavigationError";
  }
}

export class ParseError extends CliError {
  constructor(message, options = {}) {
    super(message, "PARSE_ERROR", { exitCode: EXIT_CODES.PARSE, ...options });
    this.name = "ParseError";
  }
}

export class UnsupportedOperationError extends CliError {
  constructor(message, options = {}) {
    super(message, "UNSUPPORTED_OPERATION", { exitCode: EXIT_CODES.UNSUPPORTED, ...options });
    this.name = "UnsupportedOperationError";
  }
}

export class TimeoutError extends CliError {
  constructor(message, options = {}) {
    super(message, "TIMEOUT", { exitCode: EXIT_CODES.TIMEOUT, ...options });
    this.name = "TimeoutError";
  }
}

/**
 * Normalize any thrown value into a consistent error envelope.
 * @param {unknown} err
 * @returns {ErrorEnvelope}
 */
export function normalizeError(err) {
  if (err instanceof CliError) {
    return {
      ok: false,
      error: err.message,
      code: err.code,
      ...(err.hint ? { hint: err.hint } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }

  if (err instanceof Error) {
    return {
      ok: false,
      error: err.message,
      code: err.code ?? "UNKNOWN_ERROR",
    };
  }

  return {
    ok: false,
    error: String(err),
    code: "UNKNOWN_ERROR",
  };
}

/**
 * Get the exit code for a given error.
 * @param {unknown} err
 * @returns {number}
 */
export function getExitCode(err) {
  if (err instanceof CliError) return err.exitCode;
  return EXIT_CODES.GENERAL;
}
