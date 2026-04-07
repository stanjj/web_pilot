import { buildRegistry } from "./command-registrations.mjs";
import { CliError, normalizeError, getExitCode, EXIT_CODES } from "./core/errors.mjs";
import { emitJsonFailure, executeJsonMode } from "./core/json-mode.mjs";

/**
 * Parse process.argv into positional args and --flag values.
 * Preserved from the original CLI for backward compatibility.
 */
function parseFlags(argv) {
  const args = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { args, flags };
}

function hasFlag(flags, name) {
  return Object.prototype.hasOwnProperty.call(flags, name);
}

function compareCommands(left, right) {
  return left.action.localeCompare(right.action);
}

function getCommandDisplayName(cmd) {
  if (cmd.action === "default") {
    return cmd.site;
  }

  return `${cmd.site} ${cmd.action}`;
}

function getActionDisplayName(cmd) {
  if (cmd.action === "default") {
    return cmd.site;
  }

  return cmd.action;
}

function getCommandUsage(cmd) {
  return cmd.usage || `node src/cli.mjs ${getCommandDisplayName(cmd)}`;
}

function getCommandDescription(cmd) {
  return cmd.description || getCommandDisplayName(cmd);
}

function formatCommandLines(cmd, indent = "") {
  const lines = [`${indent}${getActionDisplayName(cmd)} - ${getCommandDescription(cmd)}`];
  lines.push(`${indent}  usage: ${getCommandUsage(cmd)}`);

  if (cmd.aliases?.length) {
    lines.push(`${indent}  aliases: ${cmd.aliases.join(", ")}`);
  }

  return lines;
}

function printGlobalHelp(registry, stream = process.stdout) {
  const allCommands = registry.listAll();
  const sites = [...new Set(allCommands.map((cmd) => cmd.site))].sort();
  const lines = [
    "Usage:",
    "  node src/cli.mjs --help",
    "  node src/cli.mjs <site> --help",
    "  node src/cli.mjs <site> <action> --help",
    "",
    "Available sites and commands:",
  ];

  for (const site of sites) {
    lines.push(`  ${site}`);
    const siteCommands = registry.listBySite(site).sort(compareCommands);
    for (const cmd of siteCommands) {
      lines.push(...formatCommandLines(cmd, "    "));
    }
  }

  stream.write(lines.join("\n") + "\n");
}

function printSiteHelp(registry, site, stream = process.stdout) {
  const siteCommands = registry.listBySite(site).sort(compareCommands);
  const lines = [
    `Site: ${site}`,
    `Commands: ${siteCommands.length}`,
    "",
  ];

  for (const cmd of siteCommands) {
    lines.push(...formatCommandLines(cmd, "  "));
  }

  stream.write(lines.join("\n") + "\n");
}

function printCommandHelp(cmd, stream = process.stdout) {
  const lines = [
    `Command: ${getCommandDisplayName(cmd)}`,
    `Description: ${getCommandDescription(cmd)}`,
    `Usage: ${getCommandUsage(cmd)}`,
  ];

  if (cmd.aliases?.length) {
    lines.push(`Aliases: ${cmd.aliases.join(", ")}`);
  }

  stream.write(lines.join("\n") + "\n");
}

function printUsage(registry, stream = process.stderr) {
  printGlobalHelp(registry, stream);
}

function createUsageError(message) {
  return new CliError(message, "USAGE_ERROR", {
    hint: "Run node src/cli.mjs --help to see usage.",
    exitCode: EXIT_CODES.USAGE,
  });
}

async function main() {
  const registry = buildRegistry();
  // Extract --json before parseFlags so it isn't consumed as a key-value pair.
  const rawArgs = process.argv.slice(2);
  const jsonIdx = rawArgs.indexOf("--json");
  const jsonMode = jsonIdx !== -1;
  const cleanArgs = jsonMode
    ? [...rawArgs.slice(0, jsonIdx), ...rawArgs.slice(jsonIdx + 1)]
    : rawArgs;
  const { args, flags } = parseFlags(cleanArgs);
  const [site, action, ...extraArgs] = args;
  const wantsHelp = hasFlag(flags, "help");
  const label = [site, action].filter(Boolean).join(" ");

  if (!site) {
    if (!wantsHelp && jsonMode) {
      emitJsonFailure(createUsageError("Missing command."));
      process.exitCode = EXIT_CODES.USAGE;
      return;
    }

    printUsage(registry, wantsHelp ? process.stdout : process.stderr);
    if (!wantsHelp) {
      process.exit(EXIT_CODES.USAGE);
    }
    return;
  }

  // "doctor" is a single-word command (no action)
  const resolvedAction = (site === "doctor" && !action) ? "default" : action;

  if (wantsHelp) {
    if (action) {
      const helpCommand = registry.resolve(site, resolvedAction || "");
      if (!helpCommand) {
        if (jsonMode) {
          emitJsonFailure(createUsageError(`Unknown command: ${label}`), { command: label });
          process.exitCode = EXIT_CODES.USAGE;
          return;
        }

        process.stderr.write(`Unknown command: ${label}\nRun node src/cli.mjs --help to see usage.\n`);
        process.exit(EXIT_CODES.USAGE);
      }

      printCommandHelp(helpCommand);
      return;
    }

    const siteCommands = registry.listBySite(site);
    if (siteCommands.length > 0) {
      printSiteHelp(registry, site);
      return;
    }

    if (jsonMode) {
      emitJsonFailure(createUsageError(`Unknown site: ${site}`), { command: site });
      process.exitCode = EXIT_CODES.USAGE;
      return;
    }

    process.stderr.write(`Unknown site: ${site}\nRun node src/cli.mjs --help to see usage.\n`);
    process.exit(EXIT_CODES.USAGE);
  }

  const cmd = registry.resolve(site, resolvedAction || "");

  if (cmd) {
    if (jsonMode) {
      await executeJsonMode(cmd, flags, extraArgs);
    } else {
      await cmd.handler(flags, extraArgs);
    }
    return;
  }

  if (jsonMode) {
    emitJsonFailure(createUsageError(`Unknown command: ${label}`), { command: label });
    process.exitCode = EXIT_CODES.USAGE;
    return;
  }

  process.stderr.write(`Unknown command: ${label}\nRun node src/cli.mjs --help to see usage.\n`);
  process.exit(EXIT_CODES.USAGE);
}

main().catch((error) => {
  if (process.argv.slice(2).includes("--json")) {
    emitJsonFailure(error);
    process.exit(getExitCode(error));
  }

  const envelope = normalizeError(error);
  process.stderr.write(`${envelope.error}\n`);
  if (envelope.hint) {
    process.stderr.write(`Hint: ${envelope.hint}\n`);
  }
  process.exit(getExitCode(error));
});
