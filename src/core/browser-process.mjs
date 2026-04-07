import path from "node:path";

function normalizeWindowsPath(value) {
  const raw = String(value || "").trim().replace(/^"|"$/g, "");
  if (!raw) return "";
  return path.win32.normalize(raw).replace(/[\\/]+$/, "").toLowerCase();
}

function toProcessEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  return {
    processId: Number(entry.ProcessId ?? entry.processId ?? 0),
    commandLine: String(entry.CommandLine ?? entry.commandLine ?? "").trim(),
  };
}

function tokenizeCommandLine(commandLine) {
  const tokens = [];
  const source = String(commandLine || "");
  const pattern = /"([^"]*)"|(\S+)/g;
  let match = null;

  while ((match = pattern.exec(source))) {
    tokens.push(match[1] ?? match[2] ?? "");
  }

  return tokens;
}

export function getChromeCommandLineArg(commandLine, argName) {
  const normalizedArgName = String(argName || "").trim();
  if (!normalizedArgName) return "";

  const tokens = tokenizeCommandLine(commandLine);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = String(tokens[index] || "").trim();
    if (!token) continue;

    if (token === normalizedArgName) {
      return String(tokens[index + 1] || "").trim().replace(/^"|"$/g, "");
    }

    if (token.startsWith(`${normalizedArgName}=`)) {
      return token.slice(normalizedArgName.length + 1).trim().replace(/^"|"$/g, "");
    }
  }

  return "";
}

export function classifyChromeDebuggerOwner(processes, { port, profileDir }) {
  const expectedPort = String(port);
  const expectedProfileDir = normalizeWindowsPath(profileDir);
  const entries = (Array.isArray(processes) ? processes : [processes])
    .map(toProcessEntry)
    .filter((entry) => entry?.commandLine);

  const portMatches = entries.filter(
    (entry) => getChromeCommandLineArg(entry.commandLine, "--remote-debugging-port") === expectedPort,
  );

  if (!portMatches.length) {
    return {
      ok: false,
      code: "PROCESS_NOT_FOUND",
      matches: [],
    };
  }

  const exactMatch = portMatches.find(
    (entry) => normalizeWindowsPath(getChromeCommandLineArg(entry.commandLine, "--user-data-dir")) === expectedProfileDir,
  );

  if (exactMatch) {
    return {
      ok: true,
      verified: true,
      processId: exactMatch.processId,
      profileDir: getChromeCommandLineArg(exactMatch.commandLine, "--user-data-dir"),
    };
  }

  return {
    ok: false,
    code: "PROFILE_MISMATCH",
    matches: portMatches.map((entry) => ({
      processId: entry.processId,
      profileDir: getChromeCommandLineArg(entry.commandLine, "--user-data-dir"),
    })),
  };
}