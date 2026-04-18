function normalizeBossThreadText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyScore(query, text) {
  if (!query || !text) return Infinity;
  const dist = editDistance(query, text);
  const maxLen = Math.max(query.length, text.length);
  return maxLen === 0 ? 0 : dist / maxLen;
}

function bestFuzzyScoreForItem(query, item) {
  const fields = [
    normalizeBossThreadText(item.name),
    normalizeBossThreadText(item.company),
    normalizeBossThreadText(item.title),
    [normalizeBossThreadText(item.name), normalizeBossThreadText(item.company)].filter(Boolean).join(" "),
    [normalizeBossThreadText(item.company), normalizeBossThreadText(item.name)].filter(Boolean).join(" "),
  ].filter(Boolean);
  let best = Infinity;
  for (const field of fields) {
    const score = fuzzyScore(query, field);
    if (score < best) best = score;
  }
  return best;
}

function buildCandidatePreview(item) {
  return {
    domIndex: item.domIndex,
    name: item.name,
    company: item.company,
    title: item.title,
    preview: item.preview,
  };
}

function buildExactKeys(item) {
  const name = normalizeBossThreadText(item.name);
  const company = normalizeBossThreadText(item.company);
  const title = normalizeBossThreadText(item.title);

  return new Set(
    [
      [name, company].filter(Boolean).join(" "),
      [company, name].filter(Boolean).join(" "),
      [name, company, title].filter(Boolean).join(" "),
      [company, name, title].filter(Boolean).join(" "),
    ].filter(Boolean),
  );
}

function buildSearchFields(item) {
  const name = normalizeBossThreadText(item.name);
  const company = normalizeBossThreadText(item.company);
  const title = normalizeBossThreadText(item.title);

  return [
    name,
    company,
    title,
    [name, company].filter(Boolean).join(" "),
    [company, name].filter(Boolean).join(" "),
    [name, company, title].filter(Boolean).join(" "),
    [company, name, title].filter(Boolean).join(" "),
  ].filter(Boolean);
}

export function isBossThreadContextMatch(current, expected) {
  const normalizedCurrent = {
    name: normalizeBossThreadText(current?.name),
    company: normalizeBossThreadText(current?.company),
    title: normalizeBossThreadText(current?.title),
  };
  const normalizedExpected = {
    name: normalizeBossThreadText(expected?.name),
    company: normalizeBossThreadText(expected?.company),
    title: normalizeBossThreadText(expected?.title),
  };

  if (!normalizedExpected.name || normalizedCurrent.name !== normalizedExpected.name) {
    return false;
  }
  if (normalizedExpected.company && normalizedCurrent.company !== normalizedExpected.company) {
    return false;
  }
  if (normalizedExpected.title && normalizedCurrent.title !== normalizedExpected.title) {
    return false;
  }

  return true;
}

function createSuccess(item, matchType) {
  return {
    ok: true,
    item,
    matchType,
  };
}

function createAmbiguous(query, matches) {
  return {
    ok: false,
    code: "AMBIGUOUS_THREAD",
    error: `Ambiguous thread selector: ${query}`,
    candidates: matches.slice(0, 5).map(buildCandidatePreview),
  };
}

export function formatBossThreadSelectionError(result) {
  if (!result?.candidates?.length) {
    return result?.error || "Failed to resolve BOSS thread";
  }

  const candidates = result.candidates
    .map((item) => `[${item.domIndex}] ${item.name} / ${item.company} / ${item.title}`.trim())
    .join("; ");

  return `${result.error}. Candidates: ${candidates}`;
}

export function isBossThreadSelectionSafeForSend(selection) {
  return selection?.ok === true && (selection.matchType === "index" || selection.matchType === "exact" || selection.matchType === "fuzzy");
}

export function resolveBossThreadSelection(items, { index, name } = {}) {
  const threads = Array.isArray(items) ? items : [];

  if (Number.isInteger(index)) {
    const indexed = threads.find((item) => item.domIndex === index) || null;
    if (!indexed) {
      return {
        ok: false,
        code: "THREAD_NOT_FOUND",
        error: `Thread not found at index: ${index}`,
      };
    }

    return createSuccess(indexed, "index");
  }

  const query = normalizeBossThreadText(name);
  if (!query) {
    return {
      ok: false,
      code: "MISSING_THREAD_SELECTOR",
      error: "Missing thread selector",
    };
  }

  const exactMatches = threads.filter((item) => buildExactKeys(item).has(query));
  if (exactMatches.length === 1) return createSuccess(exactMatches[0], "exact");
  if (exactMatches.length > 1) return createAmbiguous(name, exactMatches);

  const tokens = query.split(" ").filter(Boolean);
  const tokenMatches = threads.filter((item) => {
    const fields = buildSearchFields(item);
    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });

  if (tokenMatches.length === 1) return createSuccess(tokenMatches[0], "token");
  if (tokenMatches.length > 1) return createAmbiguous(name, tokenMatches);

  const substringMatches = threads.filter((item) => buildSearchFields(item).some((field) => field.includes(query)));
  if (substringMatches.length === 1) return createSuccess(substringMatches[0], "substring");
  if (substringMatches.length > 1) return createAmbiguous(name, substringMatches);

  // Stage 5: fuzzy match — edit distance ratio below 0.35 threshold
  const FUZZY_THRESHOLD = 0.35;
  const scored = threads
    .map((item) => ({ item, score: bestFuzzyScoreForItem(query, item) }))
    .filter(({ score }) => score <= FUZZY_THRESHOLD)
    .sort((a, b) => a.score - b.score);

  if (scored.length === 1) return createSuccess(scored[0].item, "fuzzy");
  if (scored.length > 1 && scored[0].score < scored[1].score - 0.05) {
    return createSuccess(scored[0].item, "fuzzy");
  }
  if (scored.length > 1) return createAmbiguous(name, scored.map(({ item }) => item));

  return {
    ok: false,
    code: "THREAD_NOT_FOUND",
    error: `Thread not found: ${String(name || "").trim()}`,
  };
}