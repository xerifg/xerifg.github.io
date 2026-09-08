export function normalizePublishTagInput(tag) {
  const text = String(tag || "").trim().replace(/\s+/g, " ");
  return text;
}

export function stablePublishTags(tags) {
  const result = [];
  const seen = new Set();
  for (const tag of Array.isArray(tags) ? tags : []) {
    const text = normalizePublishTagInput(tag);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

export function buildPublishTagSuggestions(catalog, query, selectedTags = [], limit = 4) {
  const normalizedQuery = normalizePublishTagInput(query).toLowerCase();
  const selected = new Set(stablePublishTags(selectedTags));
  const ranked = stablePublishTags(catalog)
    .filter((tag) => !selected.has(tag) && tag.toLowerCase() !== normalizedQuery)
    .map((tag) => ({
      tag,
      score: scoreTagMatch(tag, normalizedQuery)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.tag.length - right.tag.length || left.tag.localeCompare(right.tag, "zh-Hans-CN"));
  return ranked.slice(0, Math.max(0, Number(limit) || 0)).map((item) => item.tag);
}

function scoreTagMatch(tag, normalizedQuery) {
  if (!normalizedQuery) return 0;
  const candidate = tag.toLowerCase();
  let score = 0;
  if (candidate.includes(normalizedQuery)) score += 4;
  if (normalizedQuery.includes(candidate)) score += 3;
  if (candidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(candidate)) score += 2;
  const queryChars = new Set(Array.from(normalizedQuery).filter((char) => char.trim()));
  const candidateChars = new Set(Array.from(candidate).filter((char) => char.trim()));
  for (const char of queryChars) {
    if (candidateChars.has(char)) score += 1;
  }
  return score;
}
