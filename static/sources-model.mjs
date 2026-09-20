export const SOURCE_CATEGORIES = ["未分类", "日报", "周报", "资讯", "工具"];
export const SOURCE_NOTE_ID = "note-1785937591317";
// Initial collection from 《每日优质信息》; an explicitly saved empty list stays empty.
export const INITIAL_SOURCES = [
  { id: "bestblogs", name: "BestBlogs", url: "https://www.bestblogs.dev/explore/newsletter", description: "精选技术文章与每周好内容", category: "周报" },
  { id: "ruanyifeng", name: "阮一峰的网络日志", url: "https://www.ruanyifeng.com/blog/index.html", description: "科技爱好者的每周阅读清单", category: "周报" },
  { id: "hex2077", name: "何夕2077", url: "https://hex2077.dev/", description: "AI 资讯日报与深度周报", category: "日报" },
  { id: "zhidx", name: "智东西", url: "https://www.zhidx.com/", description: "AI、芯片与智能汽车产业资讯", category: "资讯" },
  { id: "hacker-news", name: "Hacker News on the Go", url: "https://hn.etelej.com/", description: "轻量浏览技术社区热点", category: "资讯" },
  { id: "inoreader", name: "Inoreader", url: "https://www.inoreader.com/dashboard", description: "集中打开自己的 RSS 阅读空间", category: "工具" }
];
export function sourceURL(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
export function sourceURLKey(value) {
  const safe = sourceURL(value); if (!safe) return "";
  const url = new URL(safe); url.hash = "";
  return url.href.replace(/\/$/, "");
}
export function normalizeSources(value) {
  const ids = new Set(), urls = new Set();
  return (Array.isArray(value) ? value : INITIAL_SOURCES).flatMap(item => {
    const url = sourceURL(item?.url), key = sourceURLKey(url), name = String(item?.name || "").trim().slice(0, 100);
    if (!item?.id || typeof item.id !== "string" || !name || !url || ids.has(item.id) || urls.has(key)) return [];
    ids.add(item.id); urls.add(key);
    return [{ id: item.id, name, url, description: String(item.description || "").trim().slice(0, 300), category: SOURCE_CATEGORIES.includes(item.category) ? item.category : "未分类", pinned: item.pinned === true }];
  });
}
export function saveSource(sources, item) {
  if (!String(item.name || "").trim()) throw new Error("请填写网站名称");
  if (!sourceURL(item.url)) throw new Error("请填写有效的 http:// 或 https:// 网址，且不要包含账号密码");
  if (sources.some(s => s.id !== item.id && sourceURLKey(s.url) === sourceURLKey(item.url))) throw new Error("这个网站已在清单中，请编辑已有网站");
  return normalizeSources(sources.some(s => s.id === item.id) ? sources.map(s => s.id === item.id ? item : s) : [...sources, item]);
}
export function visibleSources(sources, query = "", category = "全部") {
  const text = query.trim().toLocaleLowerCase();
  return sources.filter(s => (category === "全部" || s.category === category) && `${s.name} ${s.url} ${s.description}`.toLocaleLowerCase().includes(text))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
}
export function moveSource(sources, id, targetId) {
  const from = sources.findIndex(s => s.id === id), to = sources.findIndex(s => s.id === targetId);
  if (from < 0 || to < 0 || sources[from].pinned !== sources[to].pinned) return sources;
  const next = [...sources]; next.splice(to, 0, ...next.splice(from, 1)); return next;
}
