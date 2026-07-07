export function buildTagLinks(notes, visibleTagNames) {
  const visible = new Set(visibleTagNames);
  const order = new Map(visibleTagNames.map((tag, index) => [tag, index]));
  const counts = new Map();

  notes.forEach((note) => {
    const tags = Array.from(new Set(note.tags || []))
      .filter((tag) => visible.has(tag))
      .sort((a, b) => order.get(a) - order.get(b));

    for (let i = 0; i < tags.length; i += 1) {
      for (let j = i + 1; j < tags.length; j += 1) {
        const key = `${tags[i]}\u0000${tags[j]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  });

  return Array.from(counts.entries())
    .map(([key, weight]) => {
      const [source, target] = key.split("\u0000");
      return { source, target, weight };
    })
    .sort((a, b) => {
      const sourceDelta = order.get(a.source) - order.get(b.source);
      const targetDelta = order.get(a.target) - order.get(b.target);
      return b.weight - a.weight || sourceDelta || targetDelta;
    });
}

export function layoutNetworkNodes(tags, width, height) {
  const cx = width / 2;
  const cy = height * .64;
  const count = Math.max(1, tags.length);
  const ringX = Math.min(410, Math.max(180, width * .29));
  const ringY = Math.min(210, Math.max(120, height * .18));
  const start = -Math.PI / 2;

  return tags.map((tag, index) => {
    const isCenter = index === 0;
    const angle = start + ((index - 1) / Math.max(1, count - 1)) * Math.PI * 2;
    const lane = index % 2 ? .88 : 1.08;
    const x = isCenter ? cx : cx + Math.cos(angle) * ringX * lane;
    const y = isCenter ? cy : cy + Math.sin(angle) * ringY * lane;

    return {
      ...tag,
      radius: 34 + Math.min(tag.count || 0, 8) * 3,
      x,
      y
    };
  });
}

export function noteSummariesForTag(notes, tag, limit = 3) {
  if (!tag || tag === "Notes") return notes.slice(0, limit);
  return notes.filter((note) => (note.tags || []).includes(tag)).slice(0, limit);
}
