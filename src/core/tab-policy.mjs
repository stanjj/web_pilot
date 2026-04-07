function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareMaybeNumbers(left, right) {
  if (left != null && right != null) return left - right;
  if (left != null) return -1;
  if (right != null) return 1;
  return 0;
}

export function getTabOverflow(pageCount, incomingTabs, maxTabs) {
  return Math.max(0, Number(pageCount) + Math.max(0, Number(incomingTabs) || 0) - Number(maxTabs));
}

export function selectTargetsForClosure(targets, overflow) {
  const count = Math.max(0, Math.floor(Number(overflow) || 0));
  if (!count) return [];

  return [...targets]
    .sort((left, right) => {
      const timeOrder = compareMaybeNumbers(
        toFiniteNumber(left?.lastLoadedAt),
        toFiniteNumber(right?.lastLoadedAt),
      );

      if (timeOrder !== 0) return timeOrder;

      return Number(left?.originalIndex ?? 0) - Number(right?.originalIndex ?? 0);
    })
    .slice(0, count);
}