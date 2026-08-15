import React from "https://esm.sh/react@18.3.1";
import {
  BookOpenText, ChevronDown, ChevronLeft, ChevronRight, Ellipsis, FileText, Folder, Home, NotebookTabs, PenLine, Plus, Sparkles,
  GripVertical, Search, Settings, Star, Tag, Trash2, Upload
} from "https://esm.sh/lucide-react@0.468.0?external=react";

const h = React.createElement;
const icons = {
  home: Home,
  notes: NotebookTabs,
  assistant: Sparkles,
  favorites: Star,
  tags: Tag,
  settings: Settings,
  folder: Folder,
  file: FileText,
  search: Search,
  add: Plus,
  trash: Trash2,
  library: BookOpenText,
  read: BookOpenText,
  next: ChevronRight,
  back: ChevronLeft,
  expand: ChevronRight,
  collapse: ChevronDown,
  more: Ellipsis,
  edit: PenLine,
  upload: Upload
};

export function icon(name, props = {}) {
  return h(icons[name], { size: 18, strokeWidth: 1.8, "aria-hidden": "true", ...props });
}

export function PrimaryRail({ view, onNavigate }) {
  const items = [["home", "首页"], ["library", "笔记"], ["assistant", "AI 助手"], ["tags", "标签"], ["settings", "设置"]];
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

export function LibraryHome({ summary, areas, tags, recentNotes = [], favoriteNotes = [], onCreateNote, onOpenArea, onOpenTag, onOpenNote, onOpenRecentNotes }) {
  const summaryItems = [
    ["file", summary.notes, "文档", "已记录的知识条目"],
    ["folder", summary.folders, "文件夹", "组织你的知识结构"],
    ["tags", summary.tags, "标签", "连接与检索的入口"]
  ];
  const noteRow = (note) => h("button", { key: note.id, type: "button", className: "recent-note-row", onClick: () => onOpenNote(note.id) },
    h("span", { className: "recent-note-icon" }, icon("file", { size: 20 })),
    h("span", { className: "recent-note-copy" }, h("strong", null, note.title || "未命名笔记"), h("small", null, note.excerpt || "暂无正文内容")),
    h("time", { dateTime: note.date || undefined }, note.updatedLabel),
    icon("next", { size: 17 })
  );

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
      h("section", { className: "library-section recent-notes-section favorites-notes-section", "aria-labelledby": "favorite-notes-title" },
        h("div", { className: "library-section-heading" },
          h("h2", { id: "favorite-notes-title" }, "收藏笔记")
        ),
        h("div", { className: "recent-note-list" },
          favoriteNotes.length
            ? favoriteNotes.map(noteRow)
            : h("div", { className: "library-inline-empty favorites-empty" }, "在任意笔记顶部点击星标，它会显示在这里并随 GitHub 同步。")
        )
      ),
      h("section", { className: "library-section recent-notes-section", "aria-labelledby": "recent-notes-title" },
        h("div", { className: "library-section-heading" },
          h("h2", { id: "recent-notes-title" }, "最近笔记"),
          h("button", { type: "button", className: "recent-notes-all", onClick: onOpenRecentNotes }, "查看全部")
        ),
        h("div", { className: "recent-note-list" },
          recentNotes.length
            ? recentNotes.map(noteRow)
            : h("div", { className: "library-inline-empty" }, "还没有可显示的笔记。")
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

function tagButton(tag, selectedTag, onSelectTag, className = "tag-browser-row") {
  const isSelected = selectedTag === tag.name;
  return h("button", { key: tag.name, className: `${className} ${isSelected ? "is-selected" : ""}`, "aria-pressed": isSelected, onClick: () => onSelectTag(tag.name) }, icon("tags", { size: 15 }), h("span", null, tag.name), h("small", null, `${tag.count} 篇`));
}

function renderTagIndex(model, onQuery, onSort, onSelectTag) {
  const commonTags = [...model.records].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN")).slice(0, 6);
  const categories = [
    ["technology", "技术"],
    ["topic", "主题"],
    ["tool", "工具"],
    ["status", "状态"]
  ];
  return h("div", { className: "tag-browser-index" },
    h("label", { className: "tag-browser-search" }, icon("search", { size: 17 }), h("span", { className: "sr-only" }, "搜索标签"), h("input", { type: "search", value: model.query, placeholder: "搜索标签", onChange: (event) => onQuery(event.target.value) })),
    h("div", { className: "tag-sort-control", role: "group", "aria-label": "标签排序" }, [["popular", "常用"], ["name", "名称"], ["recent", "最近创建"]].map(([value, label]) => h("button", { key: value, className: model.sort === value ? "is-active" : "", "aria-pressed": model.sort === value, onClick: () => onSort(value) }, label))),
    h("section", { className: "tag-browser-group", "aria-labelledby": "common-tags-title" }, h("h2", { id: "common-tags-title" }, "常用标签"), h("div", { className: "common-tag-list" }, commonTags.length ? commonTags.map((tag) => tagButton(tag, model.selected?.name, onSelectTag, "common-tag-button")) : h("p", { className: "tag-browser-empty" }, "没有匹配的标签。"))),
    categories.map(([category, label]) => h("section", { key: category, className: "tag-browser-group", "aria-labelledby": `tag-category-${category}` },
      h("h2", { id: `tag-category-${category}` }, label),
      h("div", { className: "all-tag-list" }, model.groups[category].length
        ? model.groups[category].map((tag) => tagButton(tag, model.selected?.name, onSelectTag))
        : h("p", { className: "tag-browser-empty" }, "暂无标签。"))))
  );
}

function renderTagDetail(selected, notesById, onOpenNote, onRenameTag) {
  if (!selected) return h("aside", { className: "tag-detail tag-detail-empty" }, icon("tags", { size: 24 }), h("h2", null, "选择一个标签"), h("p", null, "查看使用这个标签的笔记。"));
  const notes = selected.noteIds.map((id) => notesById[id]).filter(Boolean);
  return h("aside", { className: "tag-detail", "aria-labelledby": "selected-tag-title" },
    h("header", null,
      h("span", { className: "tag-detail-icon" }, icon("tags", { size: 18 })),
      h("div", null, h("h2", { id: "selected-tag-title" }, selected.name), h("p", null, `${notes.length} 篇相关笔记`)),
      h("button", { type: "button", className: "tag-rename-button", onClick: () => onRenameTag(selected.name) }, "重命名")
    ),
    h("div", { className: "tag-note-list" }, notes.map((note) => h("button", { key: note.id, className: "tag-note-row", onClick: () => onOpenNote(note.id) }, icon("file", { size: 17 }), h("span", null, note.title || "未命名笔记"), icon("next", { size: 16 })))))
}

export function TagBrowser({ model, onQuery, onSort, onSelectTag, onOpenNote, onCreateTag, onRenameTag, canCreateTag }) {
  return h("section", { className: "tag-browser", "aria-labelledby": "tag-browser-title" },
    h("header", { className: "view-header" },
      h("div", null, h("h1", { id: "tag-browser-title" }, "标签"), h("p", null, "用主题连接散落在不同目录里的知识。")),
      h("div", { className: "tag-create-control" },
        h("button", { className: "tag-create-button", disabled: !canCreateTag, onClick: onCreateTag, "aria-describedby": !canCreateTag ? "tag-create-help" : undefined }, icon("add"), "新建标签"),
        !canCreateTag ? h("small", { id: "tag-create-help" }, "先打开一篇笔记，再为它新建标签") : null
      )
    ),
    h("div", { className: "tag-browser-grid" },
      renderTagIndex(model, onQuery, onSort, onSelectTag),
      renderTagDetail(model.selected, model.notesById, onOpenNote, onRenameTag)
    )
  );
}

const settingCategories = [
  ["general", "通用"],
  ["assistant", "AI 助手"],
  ["appearance", "外观"],
  ["reading", "阅读与编辑"],
  ["tags", "标签"],
  ["sync", "数据与同步"],
  ["github", "GitHub 发布"],
  ["shortcuts", "快捷键"],
  ["about", "关于"]
];

export function SettingsSidebar({ activeCategory, onSelectCategory }) {
  return h("aside", { className: "sidebar settings-sidebar" },
    h("header", { className: "settings-sidebar-header" },
      h("strong", null, "设置"),
      h("span", null, "知识库偏好")
    ),
    h("nav", { className: "settings-navigation", "aria-label": "设置分类" },
      settingCategories.map(([id, label]) => h("button", {
        key: id,
        className: `settings-navigation-item ${activeCategory === id ? "is-active" : ""}`,
        "aria-current": activeCategory === id ? "page" : undefined,
        onClick: () => onSelectCategory(id)
      }, h("span", null, label), icon("next", { size: 15 })))
    )
  );
}

function settingRow(label, description, control) {
  return h("div", { className: "settings-row" },
    h("div", { className: "settings-row-copy" },
      h("strong", null, label),
      description ? h("p", null, description) : null
    ),
    h("div", { className: "settings-row-control" }, control)
  );
}

function settingsGroup(title, children) {
  return h("section", { className: "settings-group" },
    title ? h("h2", null, title) : null,
    h("div", { className: "settings-group-rows" }, ...children)
  );
}

function preferenceSelect(value, label, options, onChange) {
  return h("select", { value, "aria-label": label, onChange: (event) => onChange(event.target.value) },
    options.map(([optionValue, optionLabel]) => h("option", { key: optionValue, value: optionValue }, optionLabel))
  );
}

function segmentedPreference(value, label, options, onChange) {
  return h("div", { className: "settings-segmented", role: "group", "aria-label": label },
    options.map(([optionValue, optionLabel]) => h("button", {
      key: optionValue,
      type: "button",
      className: value === optionValue ? "is-active" : "",
      "aria-pressed": value === optionValue,
      onClick: () => onChange(optionValue)
    }, optionLabel))
  );
}

function settingSwitch(checked, label, onChange) {
  return h("label", { className: "settings-switch" },
    h("input", { type: "checkbox", checked, "aria-label": label, onChange: (event) => onChange(event.target.checked) }),
    h("span", { "aria-hidden": "true" })
  );
}

function generalSettings(preferences, onChangePreferences) {
  return [settingsGroup("启动", [
    settingRow("打开应用时", "默认回到知识库首页，也可以继续上次浏览位置。",
      preferenceSelect(preferences.rememberLastLocation ? "last" : "home", "启动视图", [["home", "知识库首页"], ["last", "上次位置"]], (value) => onChangePreferences({ rememberLastLocation: value === "last" })))
  ])];
}

function appearanceSettings(preferences, onChangePreferences) {
  return [settingsGroup("界面", [
    settingRow("主题", "自动模式会跟随系统外观。",
      segmentedPreference(preferences.theme, "主题", [["auto", "自动"], ["light", "浅色"], ["dark", "深色"]], (theme) => onChangePreferences({ theme }))),
    settingRow("侧栏密度", "调整目录和导航行的垂直间距。",
      segmentedPreference(preferences.sidebarDensity, "侧栏密度", [["comfortable", "舒适"], ["compact", "紧凑"]], (sidebarDensity) => onChangePreferences({ sidebarDensity }))),
    settingRow("半透明材质", "允许侧栏和浮层使用系统式模糊材质。",
      settingSwitch(preferences.translucentMaterials, "半透明材质", (translucentMaterials) => onChangePreferences({ translucentMaterials })))
  ])];
}

function readingSettings(preferences, onChangePreferences) {
  return [settingsGroup("文档", [
    settingRow("正文宽度", `${preferences.contentWidthRatio}%`,
      h("input", { type: "range", min: 50, max: 100, step: 1, value: preferences.contentWidthRatio, "aria-label": "正文宽度", onChange: (event) => onChangePreferences({ contentWidthRatio: Number(event.target.value) }) })),
    settingRow("显示文档大纲", "在文档旁显示标题导航。",
      settingSwitch(preferences.showOutline, "显示文档大纲", (showOutline) => onChangePreferences({ showOutline }))),
    settingRow("默认模式", "选择或新建笔记时使用的模式。",
      preferenceSelect(preferences.defaultMode, "默认模式", [["read", "阅读"], ["edit", "编辑"]], (defaultMode) => onChangePreferences({ defaultMode })))
  ])];
}

function assistantSettings(assistant, onChangeAssistant) {
  const update = (field, value) => onChangeAssistant({ ...assistant, [field]: value });
  return [settingsGroup("DeepSeek", [
    settingRow("API Key", "仅用于从浏览器直接请求 DeepSeek。默认仅在本次页面会话保留；勾选记住后会保存到此浏览器。", h("input", {
      type: "password",
      value: assistant.apiKey || "",
      autoComplete: "off",
      placeholder: "sk-…",
      "aria-label": "DeepSeek API Key",
      onChange: (event) => update("apiKey", event.target.value)
    })),
    settingRow("记住此设备", "仅在你自己的受信任设备上开启。", settingSwitch(Boolean(assistant.rememberKey), "记住 DeepSeek API Key", (rememberKey) => update("rememberKey", rememberKey))),
    settingRow("模型", "用于基于笔记的问答。", h("input", {
      type: "text",
      value: assistant.model || "deepseek-chat",
      placeholder: "deepseek-chat",
      "aria-label": "DeepSeek 模型",
      onChange: (event) => update("model", event.target.value)
    }))
  ])];
}

function moveTag(tags, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= tags.length || toIndex >= tags.length) return tags;
  const nextTags = [...tags];
  const [tag] = nextTags.splice(fromIndex, 1);
  nextTags.splice(toIndex, 0, tag);
  return nextTags;
}

function tagOrderSettings(tags = [], onReorderTags = () => {}, onDeleteTag = () => {}) {
  return [settingsGroup("标签顺序", [
    h(TagOrderList, { tags, onReorderTags, onDeleteTag })
  ])];
}

function TagOrderList({ tags = [], onReorderTags = () => {}, onDeleteTag = () => {} }) {
  const [draggingTag, setDraggingTag] = React.useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = React.useState("");
  const reorder = (fromIndex, toIndex) => {
    const nextTags = moveTag(tags, fromIndex, toIndex);
    if (nextTags !== tags) onReorderTags(nextTags);
  };
  const confirmDelete = () => {
    if (!pendingDeleteTag) return;
    onDeleteTag(pendingDeleteTag);
    setPendingDeleteTag("");
  };
  const cancelDelete = () => setPendingDeleteTag("");

  return h(React.Fragment, null,
    h("div", { className: "settings-tag-order", role: "list", "aria-label": "标签顺序" },
      tags.length
        ? tags.map((tag, index) => h("div", {
            key: tag,
            className: `settings-tag-row ${draggingTag === tag ? "is-dragging" : ""}`,
            role: "listitem",
            draggable: true,
            onDragStart: (event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
              setDraggingTag(tag);
            },
            onDragEnd: () => setDraggingTag(""),
            onDragOver: (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            },
            onDrop: (event) => {
              event.preventDefault();
              const fromIndex = Number(event.dataTransfer.getData("text/plain"));
              if (Number.isInteger(fromIndex)) reorder(fromIndex, index);
              setDraggingTag("");
            }
          },
          h("span", { className: "settings-tag-drag", title: "拖拽排序", "aria-label": "拖拽排序" },
            h(GripVertical, { size: 18, strokeWidth: 1.9, "aria-hidden": "true" })
          ),
          h("strong", null, tag)
        ))
        : h("p", { className: "settings-empty" }, "暂无可排序标签。")
    ),
    draggingTag ? h("div", {
      className: "settings-tag-trash-dropzone",
      role: "button",
      tabIndex: -1,
      "aria-label": "拖到这里删除标签",
      onDragOver: (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDrop: (event) => {
        event.preventDefault();
        const fromIndex = Number(event.dataTransfer.getData("text/plain"));
        const tag = draggingTag || (Number.isInteger(fromIndex) ? tags[fromIndex] : "");
        setDraggingTag("");
        if (tag) setPendingDeleteTag(tag);
      }
    }, h(Trash2, { size: 22, strokeWidth: 1.9, "aria-hidden": "true" }), h("span", null, "拖到这里删除标签")) : null,
    pendingDeleteTag ? h("div", { className: "tag-delete-confirm-backdrop", role: "presentation" },
      h("div", { className: "tag-delete-confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "tag-delete-confirm-title" },
        h("h3", { id: "tag-delete-confirm-title" }, "删除标签？"),
        h("p", null, `确定删除「${pendingDeleteTag}」吗？会从已使用该标签的文档中移除。`),
        h("div", { className: "tag-delete-confirm-actions" },
          h("button", { type: "button", onClick: cancelDelete }, "取消"),
          h("button", { type: "button", className: "danger", onClick: confirmDelete }, "删除")
        )
      )
    ) : null
  );
}

function githubSettings(settings, onChangeGitHubSettings) {
  const input = (name, label, type = "text") => h("input", {
    type,
    value: settings[name] || "",
    "aria-label": label,
    autoComplete: name === "token" ? "off" : undefined,
    onChange: (event) => onChangeGitHubSettings({ [name]: event.target.value })
  });
  return [settingsGroup("仓库", [
    settingRow("所有者", "GitHub 用户或组织。", input("owner", "GitHub 所有者")),
    settingRow("仓库", "发布笔记和索引的目标仓库。", input("repo", "GitHub 仓库")),
    settingRow("分支", "当前发布流程固定使用 main。", h("input", { value: settings.branch || "main", readOnly: true, "aria-label": "GitHub 分支" })),
    settingRow("访问令牌", "令牌只在此密码输入框中编辑。", input("token", "GitHub Token", "password"))
  ])];
}

export function SettingsPage({ category, preferences, github, tags, assistant, onChangePreferences, onChangeAssistant, onReorderTags, onDeleteTag, onChangeGitHubSettings }) {
  const meta = Object.fromEntries(settingCategories);
  let groups;
  if (category === "general") groups = generalSettings(preferences, onChangePreferences);
  else if (category === "assistant") groups = assistantSettings(assistant, onChangeAssistant);
  else if (category === "appearance") groups = appearanceSettings(preferences, onChangePreferences);
  else if (category === "reading") groups = readingSettings(preferences, onChangePreferences);
  else if (category === "tags") groups = tagOrderSettings(tags, onReorderTags, onDeleteTag);
  else if (category === "github") groups = githubSettings(github, onChangeGitHubSettings);
  else if (category === "sync") groups = [settingsGroup("本地数据", [settingRow("草稿与同步", "笔记草稿保存在此浏览器；发表继续使用现有 GitHub 同步流程。", h("span", { className: "settings-value" }, "浏览器本地"))])];
  else if (category === "shortcuts") groups = [settingsGroup("键盘", [settingRow("编辑器快捷键", "编辑器保留系统和 Tiptap 的原生快捷键。", h("span", { className: "settings-value" }, "系统默认"))])];
  else groups = [settingsGroup("个人知识库", [settingRow("Notebook Library", "本地优先、选择性发表到 GitHub 的个人知识库。", h("span", { className: "settings-value" }, "v1"))])];

  return h("section", { className: "settings-page", "aria-labelledby": "settings-page-title" },
    h("header", { className: "settings-page-header" },
      h("h1", { id: "settings-page-title" }, meta[category] || meta.general),
      h("p", null, category === "github" ? "管理现有 GitHub 发布目标和凭据。" : "更改会自动保存在此浏览器。")
    ),
    h("div", { className: "settings-page-groups" }, ...groups)
  );
}
