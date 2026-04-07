/**
 * @typedef {Object} CommandDef
 * @property {string} name - Full command key: "site action" (e.g. "boss search")
 * @property {string} site
 * @property {string} action
 * @property {string[]} [aliases] - Alternative action names
 * @property {string} description
 * @property {string} [category] - e.g. "core", "finance", "social"
 * @property {boolean} [dryRunSupported]
 * @property {string} [usage] - CLI usage line
 * @property {(flags: Record<string, unknown>, extraArgs?: string[]) => Promise<void>} handler
 */

/**
 * Central command registry. Commands register themselves; cli.mjs resolves
 * and executes through this registry instead of a giant if-else chain.
 */
export class CommandRegistry {
  constructor() {
    /** @type {Map<string, CommandDef>} key = "site:action" */
    this._commands = new Map();
    /** @type {Map<string, string>} alias key → canonical key */
    this._aliases = new Map();
  }

  /**
   * Build the canonical key for a command.
   * @param {string} site
   * @param {string} action
   * @returns {string}
   */
  static key(site, action) {
    return `${site}:${action}`;
  }

  /**
   * Register a command definition.
   * @param {CommandDef} def
   */
  register(def) {
    const key = CommandRegistry.key(def.site, def.action);

    if (this._commands.has(key)) {
      throw new Error(`Duplicate command registration: ${key}`);
    }

    this._commands.set(key, def);

    if (def.aliases) {
      for (const alias of def.aliases) {
        const aliasKey = CommandRegistry.key(def.site, alias);
        if (this._aliases.has(aliasKey) || this._commands.has(aliasKey)) {
          throw new Error(`Alias collision: ${aliasKey} (for ${key})`);
        }
        this._aliases.set(aliasKey, key);
      }
    }
  }

  /**
   * Resolve a site + action to a command definition.
   * Returns undefined if not found.
   * @param {string} site
   * @param {string} action
   * @returns {CommandDef | undefined}
   */
  resolve(site, action) {
    const key = CommandRegistry.key(site, action);
    const def = this._commands.get(key);
    if (def) return def;

    const canonicalKey = this._aliases.get(key);
    if (canonicalKey) return this._commands.get(canonicalKey);

    return undefined;
  }

  /**
   * List all registered commands.
   * @returns {CommandDef[]}
   */
  listAll() {
    return [...this._commands.values()];
  }

  /**
   * List commands for a specific site.
   * @param {string} site
   * @returns {CommandDef[]}
   */
  listBySite(site) {
    return this.listAll().filter((cmd) => cmd.site === site);
  }

  /** @returns {number} */
  get size() {
    return this._commands.size;
  }
}
