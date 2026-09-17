export function searchTerms(text) {
  const tokens = [];
  for (const match of String(text).toLowerCase().matchAll(/[a-z0-9_+#.-]+|[\u3400-\u9fff]+/g)) {
    const word = match[0];
    if (/^[\u3400-\u9fff]/.test(word)) {
      if (word.length === 1) tokens.push(word);
      for (let i = 0; i < word.length - 1; i++) tokens.push(word.slice(i, i + 2));
    } else tokens.push(word);
  }
  return [...new Set(tokens)].slice(0, 32);
}

export function ftsQuery(text) {
  return searchTerms(text).map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
}

export function fuseRanks(lists, limit = 24) {
  const scores = new Map();
  lists.forEach((list) => list.forEach((id, index) => scores.set(id, (scores.get(id) || 0) + 1 / (60 + index + 1))));
  return [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([id]) => id);
}

export function inScope(doc, scope = {}) {
  if (scope.noteId && doc.id !== scope.noteId) return false;
  if (scope.folderId && !JSON.parse(doc.folder_ids).includes(scope.folderId)) return false;
  if (scope.tag && !JSON.parse(doc.tags).includes(scope.tag)) return false;
  return true;
}

export function vectorFilters(ids) {
  const filters = []; let group = [];
  const encoder = new TextEncoder();
  for (const id of ids) {
    if (encoder.encode(id).length > 64) throw new Error("Note ID exceeds indexed metadata size");
    if (encoder.encode(JSON.stringify({ noteId: { $in: [...group, id] } })).length >= 2000) {
      filters.push({ noteId: { $in: group } }); group = [];
    }
    group.push(id);
  }
  if (group.length) filters.push({ noteId: { $in: group } });
  return filters;
}

export function graphSubset(pages, center = "", depth = 1, limit = 100) {
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const edges = pages.flatMap((p) => p.links.filter((s) => s !== p.slug && bySlug.has(s)).map((target) => ({ source: p.slug, target })));
  const neighbors = new Map(pages.map((p) => [p.slug, new Set()]));
  edges.forEach(({ source, target }) => { neighbors.get(source).add(target); neighbors.get(target).add(source); });
  let selected;
  if (center && bySlug.has(center)) {
    selected = new Set([center]);
    let frontier = [center];
    for (let d = 0; d < Math.min(2, Math.max(1, depth)); d++) {
      const next = [];
      for (const slug of frontier) for (const n of neighbors.get(slug)) {
        if (!selected.has(n) && selected.size < limit) { selected.add(n); next.push(n); }
      }
      frontier = next;
    }
  } else {
    selected = new Set([...pages].sort((a, b) => neighbors.get(b.slug).size - neighbors.get(a.slug).size || a.slug.localeCompare(b.slug)).slice(0, limit).map((p) => p.slug));
  }
  return {
    nodes: pages.filter((p) => selected.has(p.slug)).map(({ slug, title, type }) => ({ slug, title, type })),
    edges: edges.filter((e) => selected.has(e.source) && selected.has(e.target)), total: pages.length
  };
}

export function safeHistory(messages) {
  return (Array.isArray(messages) ? messages : []).filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

export async function readSSE(body, onData) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = async (block) => {
    const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
    if (data && data !== "[DONE]") await onData(JSON.parse(data));
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary;
      if (buffer.length > 200000) throw new Error("Stream event too large");
      while ((boundary = buffer.indexOf("\n\n")) >= 0) { await dispatch(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
      if (done) { if (buffer.trim()) await dispatch(buffer); break; }
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
