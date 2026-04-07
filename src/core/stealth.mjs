// src/core/stealth.mjs — Anti-detection module for CDP automation.
// Reduces obvious automation fingerprints while minimizing page breakage.
// All patches are idempotent and fail-safe.

const GUARD_KEY = "__cdpE_stealth_applied__";

// ---------------------------------------------------------------------------
// Builder helpers — each returns a JS snippet string.
// Combined into a single IIFE by generateStealthJs().
// ---------------------------------------------------------------------------

function buildGuard() {
  return `
  if (window["${GUARD_KEY}"]) return;
  Object.defineProperty(window, "${GUARD_KEY}", {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });`;
}

function buildToStringDisguise() {
  // WeakMap-based toString override so patched functions look native.
  return `
  const _disguised = new WeakMap();
  function disguise(fn, nativeName) {
    _disguised.set(fn, \`function \${nativeName || fn.name || ""}() { [native code] }\`);
    return fn;
  }
  const _origToString = Function.prototype.toString;
  const _patchedToString = function toString() {
    if (_disguised.has(this)) return _disguised.get(this);
    return _origToString.call(this);
  };
  _disguised.set(_patchedToString, "function toString() { [native code] }");
  Function.prototype.toString = _patchedToString;`;
}

function buildRuntimeHelpers() {
  return `
  function getDescriptor(target, key) {
    let current = target;
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor) return descriptor;
      current = Object.getPrototypeOf(current);
    }
    return null;
  }

  function safeDefine(target, key, descriptor) {
    try {
      Object.defineProperty(target, key, descriptor);
      return true;
    } catch (_) {
      return false;
    }
  }

  function filterAutomationEntries(entries) {
    if (!Array.isArray(entries)) return entries;
    return entries.filter(function(entry) {
      const name = entry && typeof entry.name === "string" ? entry.name : "";
      return !/^(puppeteer|playwright|__cdp)/i.test(name)
        && !/__puppeteer/i.test(name)
        && !name.toLowerCase().startsWith("devtools://");
    });
  }`;
}

function buildNavigatorPatches() {
  return `
  // --- navigator.webdriver ---
  try {
    safeDefine(navigator, "webdriver", {
      get: disguise(function webdriver() { return false; }, "get webdriver"),
      configurable: false,
      enumerable: false,
    });
  } catch (_) {}

  // --- window.chrome stub ---
  try {
    if (!window.chrome) {
      const chromeStub = { runtime: {}, csi: function() {}, loadTimes: function() {} };
      disguise(chromeStub.csi, "csi");
      disguise(chromeStub.loadTimes, "loadTimes");
      safeDefine(window, "chrome", {
        value: chromeStub,
        configurable: true,
        enumerable: false,
        writable: true,
      });
    }
  } catch (_) {}

  // --- navigator.plugins ---
  try {
    if (!navigator.plugins || navigator.plugins.length === 0) {
      const fakePlugins = {
        length: 3,
        item: disguise(function item(i) { return fakePlugins[i] || null; }, "item"),
        namedItem: disguise(function namedItem(name) {
          for (let i = 0; i < fakePlugins.length; i++) {
            if (fakePlugins[i] && fakePlugins[i].name === name) return fakePlugins[i];
          }
          return null;
        }, "namedItem"),
        refresh: disguise(function refresh() {}, "refresh"),
        0: { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format", length: 1,
             0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" } },
        1: { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "", length: 1,
             0: { type: "application/pdf", suffixes: "pdf", description: "" } },
        2: { name: "Native Client", filename: "internal-nacl-plugin", description: "", length: 2,
             0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable" },
             1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable" } },
        [Symbol.iterator]: function* () { for (let i = 0; i < this.length; i++) yield this[i]; },
      };
      safeDefine(navigator, "plugins", {
        get: disguise(function plugins() { return fakePlugins; }, "get plugins"),
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_) {}

  // --- navigator.languages ---
  try {
    const existing = navigator.languages;
    if (!existing || !Array.isArray(existing) || existing.length === 0) {
      safeDefine(navigator, "languages", {
        get: disguise(function languages() { return ["en-US", "en"]; }, "get languages"),
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_) {}`;
}

function buildPermissionsPatch() {
  return `
  // --- Permissions.query normalization ---
  try {
    const permissions = navigator.permissions;
    const descriptor = permissions && getDescriptor(permissions, "query");
    const _origQuery = descriptor && typeof descriptor.value === "function"
      ? descriptor.value
      : permissions && typeof permissions.query === "function"
        ? permissions.query
        : null;
    if (permissions && _origQuery) {
      safeDefine(permissions, "query", {
        value: disguise(function query(desc) {
        if (desc && desc.name === "notifications") {
            const permission = typeof Notification !== "undefined" && typeof Notification.permission === "string"
              ? Notification.permission
              : "default";
            return Promise.resolve({
              state: permission === "default" ? "prompt" : permission,
              onchange: null,
            });
        }
        return _origQuery.call(this, desc);
        }, "query"),
        configurable: true,
        enumerable: false,
        writable: true,
      });
    }
  } catch (_) {}`;
}

function buildArtifactCleanup() {
  // Remove known automation globals. Targeted list — no broad patterns.
  return `
  try {
    function cleanupTarget(target) {
      if (!target) return;
      const keys = Object.getOwnPropertyNames(target);
      for (const key of keys) {
        const isKnownArtifact = key === "__playwright"
          || key === "__puppeteer_evaluation_script__"
          || key === "__puppeteer_utility_world__"
          || /^\\$?cdc_/i.test(key);
        if (!isKnownArtifact) continue;
        try {
          delete target[key];
        } catch (_) {
          safeDefine(target, key, {
            get: disguise(function artifactGetter() { return undefined; }, "get " + key),
            set: disguise(function artifactSetter() {}, "set " + key),
            configurable: true,
            enumerable: false,
          });
        }
      }
    }

    cleanupTarget(window);
    cleanupTarget(document);
  } catch (_) {}`;
}

function buildStackCleanup() {
  // Light Error.stack filter — remove puppeteer/playwright frames, keep rest.
  return `
  try {
    const _origStackDesc = getDescriptor(Error.prototype, "stack");
    if (_origStackDesc && typeof _origStackDesc.get === "function") {
      const _origStackGet = _origStackDesc.get;
      safeDefine(Error.prototype, "stack", {
        get: disguise(function stack() {
          const raw = _origStackGet.call(this);
          if (typeof raw !== "string") return raw;
          return raw.split("\\n").filter(function(line) {
            return !/\bpuppeteer\b|\bplaywright\b|__puppeteer|debugger eval code|[\\\\/]DevTools[\\\\/]/i.test(line);
          }).join("\\n");
        }, "get stack"),
        set: _origStackDesc.set,
        configurable: true,
        enumerable: false,
      });
    }
  } catch (_) {}`;
}

function buildDynamicCodeDefense() {
  // Conservative: only wrap Function constructor to strip debugger statements
  // from dynamic code. Does NOT rewrite eval broadly — too risky for real apps.
  // Tradeoff: some advanced anti-bot checks using Function('debugger') may still
  // detect automation via timing, but we avoid breaking legitimate dynamic code.
  return `
  try {
    const _OrigFunction = Function;
    const _PatchedFunction = function Function(...args) {
      if (args.length > 0) {
        const lastIdx = args.length - 1;
        if (typeof args[lastIdx] === "string") {
          // Only strip bare debugger statements, not substrings of real code
          args[lastIdx] = args[lastIdx].replace(/\\bdebugger\\s*;?/g, "/* noop */");
        }
      }
      if (new.target) return new _OrigFunction(...args);
      return _OrigFunction(...args);
    };
    _PatchedFunction.prototype = _OrigFunction.prototype;
    Object.defineProperty(_PatchedFunction, "name", { value: "Function" });
    disguise(_PatchedFunction, "Function");
    window.Function = _PatchedFunction;
  } catch (_) {}`;
}

function buildConsoleDefense() {
  return `
  try {
    const methods = ["log", "warn", "error", "info", "debug", "table", "dir"];
    for (const m of methods) {
      if (typeof console[m] === "function") {
        disguise(console[m], m);
      }
    }
  } catch (_) {}`;
}

function buildWindowDefense() {
  // Reduce DevTools-open anomalies in outerWidth/outerHeight.
  return `
  try {
    const _origOuterWidth = getDescriptor(window, "outerWidth");
    const _origOuterHeight = getDescriptor(window, "outerHeight");
    if (_origOuterWidth && typeof _origOuterWidth.get === "function") {
      const _getOW = _origOuterWidth.get;
      safeDefine(window, "outerWidth", {
        get: disguise(function outerWidth() {
          const val = _getOW.call(window);
          const inner = window.innerWidth;
          // If DevTools side-panel makes outer much wider than inner, normalize
          if (inner > 0 && val > inner * 1.5) return inner;
          return val;
        }, "get outerWidth"),
        configurable: true,
        enumerable: true,
      });
    }
    if (_origOuterHeight && typeof _origOuterHeight.get === "function") {
      const _getOH = _origOuterHeight.get;
      safeDefine(window, "outerHeight", {
        get: disguise(function outerHeight() {
          const val = _getOH.call(window);
          const inner = window.innerHeight;
          if (inner > 0 && val > inner * 1.5) return inner;
          return val;
        }, "get outerHeight"),
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_) {}`;
}

function buildPerformanceCleanup() {
  return `
  try {
    if (typeof PerformanceObserver !== "undefined" && typeof performance.getEntries === "function") {
      const _origGetEntries = performance.getEntries;
      performance.getEntries = disguise(function getEntries() {
        return filterAutomationEntries(_origGetEntries.call(this));
      }, "getEntries");

      const _origGetByType = performance.getEntriesByType;
      performance.getEntriesByType = disguise(function getEntriesByType(type) {
        return filterAutomationEntries(_origGetByType.call(this, type));
      }, "getEntriesByType");

      const _origGetByName = performance.getEntriesByName;
      performance.getEntriesByName = disguise(function getEntriesByName(name, type) {
        return filterAutomationEntries(_origGetByName.call(this, name, type));
      }, "getEntriesByName");
    }
  } catch (_) {}`;
}

function buildIframePatch() {
  // Ensure iframes inherit consistent chrome / webdriver state.
  return `
  try {
    function syncIframeWindow(frame) {
      try {
        const iframeWin = frame && frame.contentWindow;
        if (!iframeWin) return;
        if (iframeWin.navigator) {
          safeDefine(iframeWin.navigator, "webdriver", {
            get: disguise(function webdriver() { return false; }, "get webdriver"),
            configurable: false,
            enumerable: false,
          });
        }
        if (!iframeWin.chrome && window.chrome) {
          safeDefine(iframeWin, "chrome", {
            value: window.chrome,
            configurable: true,
            enumerable: false,
            writable: true,
          });
        }
      } catch (_) {}
    }

    const _origCreateElement = document.createElement;
    document.createElement = disguise(function createElement(tag, options) {
      const el = _origCreateElement.call(document, tag, options);
      if (typeof tag === "string" && tag.toLowerCase() === "iframe") {
        const sync = disguise(function syncContentWindow() {
          syncIframeWindow(el);
        }, "syncContentWindow");
        if (el && typeof el.addEventListener === "function") {
          try { el.addEventListener("load", sync); } catch (_) {}
        }
        try { setTimeout(sync, 0); } catch (_) {}
      }
      return el;
    }, "createElement");
  } catch (_) {}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained JS IIFE string with all stealth patches.
 * Safe to inject multiple times (idempotent via guard key).
 */
export function generateStealthJs() {
  const parts = [
    buildGuard(),
    buildToStringDisguise(),
    buildRuntimeHelpers(),
    buildNavigatorPatches(),
    buildPermissionsPatch(),
    buildArtifactCleanup(),
    buildStackCleanup(),
    buildDynamicCodeDefense(),
    buildConsoleDefense(),
    buildWindowDefense(),
    buildPerformanceCleanup(),
    buildIframePatch(),
  ];
  return `(function() {${parts.join("\n")}})();`;
}

/**
 * Inject stealth patches into a CDP page via a CdpClient instance.
 * Calls both Page.addScriptToEvaluateOnNewDocument (persistent) and
 * Runtime.evaluate (immediate). Either may fail independently.
 *
 * @param {import('./cdp.mjs').CdpClient} client
 * @returns {Promise<{ok: boolean, persistent: boolean, immediate: boolean, warnings: string[]}>}
 */
export async function injectStealth(client) {
  const js = generateStealthJs();
  const warnings = [];
  let persistent = false;
  let immediate = false;

  // Persistent injection — survives navigations
  try {
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: js });
    persistent = true;
  } catch (err) {
    warnings.push(`persistent injection failed: ${err?.message || String(err)}`);
  }

  // Immediate injection — applies to current page
  try {
    await client.send("Runtime.evaluate", {
      expression: js,
      returnByValue: true,
    });
    immediate = true;
  } catch (err) {
    warnings.push(`immediate injection failed: ${err?.message || String(err)}`);
  }

  if (!persistent && !immediate) {
    const error = new Error(
      `Stealth injection failed completely: ${warnings.join("; ")}`,
    );
    error.code = "STEALTH_INJECTION_FAILED";
    error.warnings = warnings;
    throw error;
  }

  return { ok: true, persistent, immediate, warnings };
}

export { GUARD_KEY };
