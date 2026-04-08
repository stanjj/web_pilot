import { getExitCode, EXIT_CODES } from "./errors.mjs";
import { toSuccess, toFailure } from "./output.mjs";

export function safeJsonStringify(value) {
  const parents = [];

  return JSON.stringify(
    value,
    function replacer(_key, currentValue) {
      if (typeof currentValue === "bigint") {
        return currentValue.toString();
      }

      if (typeof currentValue === "function") {
        return `[Function ${currentValue.name || "anonymous"}]`;
      }

      if (!currentValue || typeof currentValue !== "object") {
        return currentValue;
      }

      while (parents.length > 0 && parents[parents.length - 1] !== this) {
        parents.pop();
      }

      if (parents.includes(currentValue)) {
        return "[Circular]";
      }

      parents.push(currentValue);
      return currentValue;
    },
    2,
  );
}

export function writeJsonPayload(payload, stream = process.stdout) {
  stream.write(`${safeJsonStringify(payload)}\n`);
}

export function emitJsonFailure(error, meta, stream = process.stdout) {
  const payload = toFailure(error);
  writeJsonPayload(meta && Object.keys(meta).length > 0 ? { ...payload, meta } : payload, stream);
}

function extractJsonData(result, captured) {
  if (result !== undefined && result !== null) {
    return result;
  }

  if (captured.length === 0) {
    return null;
  }

  const raw = captured.join("");
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function isFailurePayload(data) {
  return Boolean(data && typeof data === "object" && "ok" in data && data.ok === false);
}

function normalizeSuccessPayload(data) {
  if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
    return data;
  }

  const { ok: _ok, ...normalized } = data;
  return normalized;
}

/**
 * Execute a command and return the structured result as a JS object.
 * Unlike executeJsonMode, this does NOT write to stdout — it returns
 * { ok, data, meta } directly. Used by the MCP server.
 *
 * @param {import('./command-registry.mjs').CommandDef} cmd
 * @param {Record<string, unknown>} flags
 * @param {string[]} extraArgs
 * @returns {Promise<{ ok: boolean, data?: unknown, meta: Record<string, unknown>, error?: string, code?: string }>}
 */
export async function executeForResult(cmd, flags, extraArgs) {
  const startMs = Date.now();
  const captured = [];

  // Intercept stdout writes so handler output is captured
  const originalWrite = process.stdout.write.bind(process.stdout);
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  process.stdout.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  };

  try {
    const result = await cmd.handler(flags, extraArgs);
    const elapsedMs = Date.now() - startMs;

    process.stdout.write = originalWrite;
    process.exitCode = previousExitCode;

    const data = extractJsonData(result, captured);
    const meta = { elapsedMs, command: cmd.name };

    if (isFailurePayload(data)) {
      return { ...data, meta };
    }

    return toSuccess(normalizeSuccessPayload(data), meta);
  } catch (error) {
    const elapsedMs = Date.now() - startMs;

    process.stdout.write = originalWrite;
    process.exitCode = previousExitCode;

    const payload = toFailure(error);
    return { ...payload, meta: { elapsedMs, command: cmd.name } };
  }
}

export async function executeJsonMode(cmd, flags, extraArgs, runtime = {}) {
  const stdout = runtime.stdout ?? process.stdout;
  const processState = runtime.processState ?? process;
  const startMs = Date.now();
  const captured = [];
  const originalWrite = stdout.write;
  const previousExitCode = processState.exitCode;

  processState.exitCode = undefined;
  stdout.write = (chunk, ..._rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  };

  try {
    const result = await cmd.handler(flags, extraArgs);
    const handlerExitCode = processState.exitCode;
    const elapsedMs = Date.now() - startMs;

    stdout.write = originalWrite;
    processState.exitCode = previousExitCode;

    const data = extractJsonData(result, captured);
    const meta = { elapsedMs, command: cmd.name };

    if (isFailurePayload(data)) {
      writeJsonPayload({ ...data, meta }, stdout);
      processState.exitCode = handlerExitCode ?? EXIT_CODES.GENERAL;
      return;
    }

    const envelope = toSuccess(normalizeSuccessPayload(data), meta);
    writeJsonPayload(envelope, stdout);
    processState.exitCode = handlerExitCode ?? EXIT_CODES.OK;
  } catch (error) {
    const elapsedMs = Date.now() - startMs;

    stdout.write = originalWrite;
    processState.exitCode = previousExitCode;

    emitJsonFailure(error, { elapsedMs, command: cmd.name }, stdout);
    processState.exitCode = getExitCode(error);
  }
}