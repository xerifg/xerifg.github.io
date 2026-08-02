export function filterCommandItems(items, query) {
  const normalized = String(query || "").trim().toLocaleLowerCase("zh-CN");
  return normalized ? items.filter((item) => item.label.toLocaleLowerCase("zh-CN").includes(normalized)) : items;
}
