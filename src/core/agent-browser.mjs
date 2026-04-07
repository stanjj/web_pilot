import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT } from "./cdp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

export const AGENT_BROWSER_PORT = DEFAULT_PORT;
export const AGENT_BROWSER_PROFILE = "agent";
export const AGENT_PROFILES_DIR = path.join(PROJECT_ROOT, "profiles");
