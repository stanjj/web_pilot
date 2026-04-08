/**
 * web-pilot MCP server
 *
 * Exposes all registered web-pilot commands as MCP tools over stdio so that
 * Claude Desktop, Cursor, Continue, Cline, and other MCP-native agents can
 * call them without exec/stdout parsing.
 *
 * Start: node src/mcp-server.mjs
 * Test:  npx @modelcontextprotocol/inspector node src/mcp-server.mjs
 *
 * Tool naming: "{site}_{action}" with hyphens converted to underscores.
 * e.g.  yahoo-finance options  →  yahoo_finance_options
 *       boss inbox            →  boss_inbox
 *
 * Input schema (all tools, Phase 1):
 *   flags:     object  — key/value pairs matching CLI --flag semantics
 *   extraArgs: string[] — positional args after site/action (rarely needed)
 *
 * Output: JSON string in the tool result's text content.
 *   Success: { ok: true, data: {...}, meta: { elapsedMs, command } }
 *   Failure: { ok: false, error: "...", code: "...", meta: {...} }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { buildRegistry } from "./command-registrations.mjs";
import { executeForResult } from "./core/json-mode.mjs";

/**
 * Convert a site+action name to a valid MCP tool name.
 * MCP tool names must match /^[a-zA-Z0-9_-]{1,64}$/.
 * We replace hyphens in site names with underscores and join with _.
 *
 * @param {string} site
 * @param {string} action
 * @returns {string}
 */
export function toToolName(site, action) {
  const normalizedSite = site.replace(/-/g, "_");
  if (!action || action === "default") {
    return normalizedSite;
  }
  const normalizedAction = action.replace(/-/g, "_");
  return `${normalizedSite}_${normalizedAction}`;
}

/**
 * Build a tool description from the command's metadata.
 *
 * @param {import('./core/command-registry.mjs').CommandDef} cmd
 * @returns {string}
 */
export function toToolDescription(cmd) {
  const parts = [];
  if (cmd.description) {
    parts.push(cmd.description);
  }
  if (cmd.usage) {
    parts.push(`CLI usage: ${cmd.usage}`);
  }
  if (isWriteCommand(cmd)) {
    parts.push(
      "⚠️  This command performs a write action on a real account. Use with explicit intent only.",
    );
  }
  return parts.join(" | ") || cmd.name;
}

/**
 * Heuristic: detect commands that write/send/post/reply to real services.
 *
 * @param {import('./core/command-registry.mjs').CommandDef} cmd
 * @returns {boolean}
 */
export function isWriteCommand(cmd) {
  const writeActions = ["reply", "send", "post", "new", "create", "submit", "upload"];
  return writeActions.some((w) => cmd.action.includes(w));
}

/**
 * Shared JSON Schema for every tool's input (Phase 1 — generic).
 */
export const GENERIC_INPUT_SCHEMA = {
  type: "object",
  properties: {
    flags: {
      type: "object",
      description:
        'Key/value pairs matching CLI --flag semantics. Example: { "symbol": "QQQ", "port": "9223" } ' +
        "is equivalent to --symbol QQQ --port 9223. Always include \"port\": \"9223\" for commands " +
        "that interact with the shared browser.",
      additionalProperties: true,
    },
    extraArgs: {
      type: "array",
      items: { type: "string" },
      description:
        "Positional arguments after site/action. Rarely needed — most commands use flags only.",
      default: [],
    },
  },
};

export function buildToolMap(registry, log = (message) => process.stderr.write(message)) {
  const allCommands = registry.listAll();

  // Build tool lookup map: toolName → CommandDef
  const toolMap = new Map();
  const seenToolNames = new Set();

  for (const cmd of allCommands) {
    const toolName = toToolName(cmd.site, cmd.action);
    if (seenToolNames.has(toolName)) {
      log(`[web-pilot mcp] Skipping duplicate tool name: ${toolName} (from ${cmd.name})\n`);
      continue;
    }
    seenToolNames.add(toolName);
    toolMap.set(toolName, cmd);
  }

  return toolMap;
}

export function buildToolsList(toolMap) {
  return [...toolMap.entries()].map(([toolName, cmd]) => ({
    name: toolName,
    description: toToolDescription(cmd),
    inputSchema: GENERIC_INPUT_SCHEMA,
  }));
}

export function normalizeToolArguments(args) {
  return {
    flags: (args && typeof args.flags === "object" && args.flags !== null)
      ? args.flags
      : {},
    extraArgs: Array.isArray(args?.extraArgs) ? args.extraArgs : [],
  };
}

export async function callTool(toolMap, name, args) {
  const cmd = toolMap.get(name);

  if (!cmd) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: false,
            error: `Unknown tool: ${name}`,
            code: "UNKNOWN_TOOL",
          }),
        },
      ],
    };
  }

  const { flags, extraArgs } = normalizeToolArguments(args);
  const result = await executeForResult(cmd, flags, extraArgs);

  return {
    isError: result.ok === false,
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export function createSequentialToolCaller(toolMap, callToolFn = callTool) {
  let pending = Promise.resolve();

  return (name, args) => {
    const next = pending.then(() => callToolFn(toolMap, name, args));
    pending = next.catch(() => {});
    return next;
  };
}

export async function main() {
  const registry = buildRegistry();
  const toolMap = buildToolMap(registry);
  const invokeTool = createSequentialToolCaller(toolMap);

  process.stderr.write(`[web-pilot mcp] Registered ${toolMap.size} tools\n`);

  // Build the tools/list response once at startup
  const toolsList = buildToolsList(toolMap);

  const server = new Server(
    { name: "web-pilot", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  // Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolsList,
  }));

  // Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return invokeTool(name, args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[web-pilot mcp] Server running on stdio. Ready.\n");
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentFilePath = path.resolve(fileURLToPath(import.meta.url));

if (entryPath === currentFilePath) {
  main().catch((err) => {
    process.stderr.write(`[web-pilot mcp] Fatal error: ${err.message}\n`);
    process.exit(1);
  });
}
