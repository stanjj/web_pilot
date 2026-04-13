/**
 * Run a promise with a per-source timeout. Returns the promise result if it
 * resolves within ms, otherwise rejects with a timeout error.
 * @param {Promise<unknown>} promise
 * @param {number} ms  0 = no timeout
 * @returns {Promise<unknown>}
 */
function withTimeout(promise, ms) {
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Fetch multiple sources concurrently. Sources that throw or time out are
 * recorded in meta.sources_skipped and do not block the result.
 *
 * @param {object} opts
 * @param {Array<{ name: string, fetch: () => Promise<unknown> }>} opts.sources
 * @param {number} [opts.timeoutMs]  Per-source timeout in ms; 0 = no timeout (default)
 * @param {(succeeded: Array<{ name: string, data: unknown }>) => unknown} opts.merge
 * @returns {Promise<{ data: unknown, meta: { sources_ok: string[], sources_skipped: string[], elapsedMs: number } }>}
 */
export async function aggregate({ sources, timeoutMs = 0, merge }) {
  const start = Date.now();

  const settled = await Promise.allSettled(
    sources.map(({ name, fetch: fetchFn }) =>
      withTimeout(fetchFn(), timeoutMs).then((data) => ({ name, data })),
    ),
  );

  const sourcesOk = [];
  const sourcesSkipped = [];
  const succeeded = [];

  for (let i = 0; i < settled.length; i += 1) {
    const { name } = sources[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      sourcesOk.push(name);
      succeeded.push(result.value);
    } else {
      sourcesSkipped.push(name);
    }
  }

  return {
    data: merge(succeeded),
    meta: {
      sources_ok: sourcesOk,
      sources_skipped: sourcesSkipped,
      elapsedMs: Date.now() - start,
    },
  };
}
