import React from "https://esm.sh/react@18.3.1";
import {
  BookOpenText, ChevronRight, FileText, Folder, Home, NotebookTabs, Plus,
  Search, Settings, Tag, Trash2
} from "https://esm.sh/lucide-react@0.468.0?external=react";

const h = React.createElement;
const icons = {
  home: Home,
  notes: NotebookTabs,
  tags: Tag,
  settings: Settings,
  folder: Folder,
  file: FileText,
  search: Search,
  add: Plus,
  trash: Trash2,
  library: BookOpenText,
  next: ChevronRight
};

export function icon(name, props = {}) {
  return h(icons[name], { size: 18, strokeWidth: 1.8, "aria-hidden": "true", ...props });
}

export function PrimaryRail({ view, onNavigate }) {
  const items = [["home", "首页"], ["library", "笔记"], ["tags", "标签"], ["settings", "设置"]];
  return h("nav", { className: "primary-rail", "aria-label": "主导航" },
    h("div", { className: "rail-brand", "aria-label": "知识库" }, icon("library")),
    h("div", { className: "rail-items" },
      items.map(([target, label]) => h("button", {
        key: target,
        className: `rail-item ${view === target ? "is-active" : ""}`,
        // Accessibility contract: aria-label: label
        "aria-label": label,
        "aria-current": view === target ? "page" : undefined,
        onClick: () => onNavigate(target)
      }, icon(target === "library" ? "notes" : target), h("span", null, label)))
    )
  );
}

export function LibraryHome({ summary, areas, tags, onCreateNote, onOpenArea, onOpenTag }) {
  const summaryItems = [
    ["file", summary.notes, "文档", "已记录的知识条目"],
    ["folder", summary.folders, "文件夹", "组织你的知识结构"],
    ["tags", summary.tags, "标签", "连接与检索的入口"]
  ];

  return h("section", { className: "library-home", "aria-labelledby": "library-home-title" },
    h("header", { className: "library-home-header" },
      h("div", null,
        h("h1", { id: "library-home-title" }, "知识库"),
        h("p", null, "你的个人知识库，系统化沉淀与连接你的想法与知识。")
      ),
      h("button", { className: "library-create-note", onClick: onCreateNote },
        icon("add", { size: 19 }), h("span", null, "新建笔记")
      )
    ),
    h("div", { className: "library-home-sections" },
      h("section", { className: "library-section", "aria-labelledby": "knowledge-areas-title" },
        h("h2", { id: "knowledge-areas-title" }, "知识领域"),
        h("div", { className: "knowledge-area-list" },
          areas.length
            ? areas.map((area) => h("button", {
                key: area.id,
                className: "knowledge-area-row",
                onClick: () => onOpenArea(area.id),
                "aria-label": `打开知识领域：${area.name}`
              },
                h("span", { className: "knowledge-area-icon" }, icon("folder", { size: 22 })),
                h("span", { className: "knowledge-area-copy" },
                  h("strong", null, area.name),
                  h("small", null, area.count ? "查看这个领域中的笔记" : "这个领域还没有笔记")
                ),
                h("span", { className: "knowledge-area-count" }, `${area.count} 篇`),
                icon("next", { size: 17 })
              ))
            : h("div", { className: "library-inline-empty" }, "新建文件夹后，它会显示在这里。")
        )
      ),
      h("section", { className: "library-section", "aria-labelledby": "tag-index-title" },
        h("h2", { id: "tag-index-title" }, "标签索引"),
        h("div", { className: "tag-index" },
          tags.length
            ? tags.map((tag) => h("button", {
                key: tag.name,
                className: "tag-index-item",
                onClick: () => onOpenTag(tag.name),
                "aria-label": `打开标签：${tag.name}`
              }, icon("tags", { size: 14 }), h("span", null, tag.name), h("small", null, tag.count)))
            : h("span", { className: "library-inline-empty" }, "为笔记添加标签后，它会显示在这里。")
        )
      ),
      h("section", { className: "library-section", "aria-labelledby": "library-summary-title" },
        h("h2", { id: "library-summary-title" }, "库概览"),
        h("div", { className: "library-summary" },
          summaryItems.map(([name, value, label, description]) => h("div", { className: "library-summary-item", key: name },
            h("span", { className: "library-summary-icon" }, icon(name, { size: 23 })),
            h("span", { className: "library-summary-copy" },
              h("strong", null, value),
              h("span", null, label),
              h("small", null, description)
            )
          ))
        )
      )
    )
  );
}
