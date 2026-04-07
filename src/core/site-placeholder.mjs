import { EXIT_CODES } from "./errors.mjs";

export async function runSitePlaceholder(site, action, flags = {}) {
  const result = {
    ok: false,
    site,
    action,
    status: "placeholder",
    message: `CDP adapter placeholder only for ${site}.`,
    flags,
  };
  process.exitCode = EXIT_CODES.UNSUPPORTED;
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
