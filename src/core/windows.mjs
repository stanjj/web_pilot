import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const MINIMIZE_SCRIPT = path.join(PROJECT_ROOT, "scripts", "minimize_chrome_window.ps1");
const POWERSHELL_EXE = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
  : "powershell.exe";

function isAutoMinimizeEnabled() {
  const value = process.env.CDP_EVERYTHING_AUTO_MINIMIZE;
  return value !== "0" && value !== "false";
}

export async function autoMinimizeChromeForPort(port) {
  if (process.platform !== "win32" || !isAutoMinimizeEnabled()) {
    return { ok: true, skipped: true };
  }

  return new Promise((resolve) => {
    try {
      execFile(
        POWERSHELL_EXE,
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          MINIMIZE_SCRIPT,
          "-Port",
          String(port),
        ],
        { windowsHide: true, timeout: 8000 },
        (error, stdout) => {
          if (error) {
            resolve({
              ok: false,
              skipped: true,
              error: error.message,
            });
            return;
          }

          try {
            resolve(JSON.parse(stdout || "{}"));
          } catch {
            resolve({ ok: true, raw: stdout });
          }
        },
      );
    } catch (error) {
      resolve({
        ok: false,
        skipped: true,
        error: error?.message || String(error),
      });
    }
  });
}
