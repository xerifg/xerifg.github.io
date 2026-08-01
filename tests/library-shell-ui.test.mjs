import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /view:\s*"home"/);
assert.match(app, /activeId:\s*""/);
assert.match(app, /h\(PrimaryRail,/);
assert.match(app, /h\(LibraryHome,/);
assert.match(app, /h\(TagBrowser,/);
assert.match(ui, /from "https:\/\/esm\.sh\/lucide-react@0\.468\.0/);
assert.match(ui, /export function SettingsSidebar/);
assert.match(ui, /export function SettingsPage/);
for (const category of ["通用", "外观", "阅读与编辑", "数据与同步", "GitHub 发布", "快捷键", "关于"]) {
  assert.match(ui, new RegExp(`"${category}"`));
}
assert.match(ui, /aria-label:\s*label/);
assert.match(ui, /export function TagBrowser/);
assert.match(app, /const uiPreferencesStorageKey = "personal-notebook-ui-preferences-v1"/);
assert.match(app, /function loadUiPreferences\(\)/);
assert.match(app, /localStorage\.setItem\(uiPreferencesStorageKey/);
assert.match(app, /document\.documentElement\.dataset\.theme\s*=\s*state\.uiPreferences\.theme/);
assert.match(app, /document\.documentElement\.dataset\.density\s*=\s*state\.uiPreferences\.sidebarDensity/);
assert.match(app, /document\.documentElement\.dataset\.transparency\s*=\s*state\.uiPreferences\.translucentMaterials\s*\?\s*"translucent"\s*:\s*"solid"/);
assert.match(app, /style\.setProperty\("--document-width",\s*`\$\{state\.uiPreferences\.contentWidthRatio\}%`\)/);
assert.match(ui, /settingRow\("正文宽度",\s*`\$\{preferences\.contentWidthRatio\}%`/);
assert.match(ui, /type: "range", min: 50, max: 100, step: 1, value: preferences\.contentWidthRatio/);
assert.match(app, /h\(SettingsSidebar,/);
assert.match(app, /h\(SettingsPage,/);
assert.match(app, /draft\.mode\s*=\s*draft\.uiPreferences\.defaultMode/);
assert.match(app, /state\.uiPreferences\.showOutline\s*\?\s*h\(DocumentOutline/);
assert.match(css, /\[data-theme="dark"\]/);
assert.match(css, /\[data-density="compact"\]/);
assert.match(css, /\[data-transparency="solid"\]/);
assert.match(css, /max-width:\s*var\(--document-width\)/);
assert.match(app, /icon\("folder",\s*\{\s*className:\s*"tree-folder-icon"\s*\}\)/);
assert.match(app, /icon\("file",\s*\{\s*className:\s*"tree-note-icon"\s*\}\)/);
assert.match(app, /"aria-current":\s*isActive\s*\?\s*"page"\s*:\s*undefined/);
assert.match(app, /role:\s*"group"/);
assert.match(app, /tabIndex:\s*treeKeyboard\.focusedId/);
assert.match(app, /onKeyDown:\s*\(event\)\s*=>\s*treeKeyboard\.onKeyDown/);
assert.match(ui, /"技术"/);
assert.match(ui, /"主题"/);
assert.match(ui, /"工具"/);
assert.match(ui, /"状态"/);
assert.match(css, /grid-template-columns:\s*56px 14% minmax\(0,\s*1fr\)/);
assert.match(css, /\.rail-item\s*\{[^}]*width:\s*48px;[^}]*display:\s*flex;[^}]*align-items:\s*center;/s, "the fixed icon rail should keep every navigation item centered in a 48px button");
assert.match(css, /\.tag-browser-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*\.72fr\)/s);
assert.match(css, /@media\s*\(max-width:\s*1100px\)\s*\{[^}]*\.tag-browser-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
assert.doesNotMatch(app, /NetworkView/);
assert.doesNotMatch(app, /back-network/);

const enterTagSource = app.slice(app.indexOf("const enterTag ="), app.indexOf("const navigate ="));
assert.match(enterTagSource, /enterTagView\(draft,\s*tag,\s*\{\s*clearQuery:\s*true\s*\}\)/);
assert.doesNotMatch(enterTagSource, /draft\.activeId\s*=/);

const tagOpenSource = app.slice(app.indexOf("const openTagNote ="), app.indexOf("const navigate ="));
assert.match(tagOpenSource, /buildTagReturnContext\(draft\)/);
assert.match(tagOpenSource, /selectNote\(noteId\)/);
assert.match(app, /back-to-tag/);

const openAreaSource = app.slice(app.indexOf("const openArea ="), app.indexOf("const updateNote ="));
assert.match(openAreaSource, /draft\.mode\s*=\s*draft\.uiPreferences\.defaultMode/);

const documentTopbarSource = app.slice(app.indexOf("function renderDocumentTopbar"), app.indexOf("function renderDocumentActionsMenu"));
const documentOverflowSource = app.slice(app.indexOf("function DocumentOverflowMenu"), app.indexOf("function renderDocumentActionsMenu"));
const documentActionsSource = app.slice(app.indexOf("function renderDocumentActionsMenu"), app.indexOf("function documentStatusText"));
assert.match(app, /const \[localPersistenceStatus,\s*setLocalPersistenceStatus\] = useState\("saved"\)/);
assert.match(app, /const notebookPersistencePayload = JSON\.stringify\(notebookStateForPersistence\(state\)\)/);
const persistenceEffectSource = app.slice(app.indexOf("const notebookPersistencePayload"), app.indexOf("localStorage.setItem(uiPreferencesStorageKey"));
assert.match(persistenceEffectSource, /setLocalPersistenceStatus\(resolveLocalPersistenceStatus\("start"\)\)/);
assert.match(persistenceEffectSource, /persist\(notebookPersistencePayload\)/);
assert.match(persistenceEffectSource, /setLocalPersistenceStatus\(resolveLocalPersistenceStatus\("success"\)\)/);
assert.match(persistenceEffectSource, /setLocalPersistenceStatus\(resolveLocalPersistenceStatus\("failure"\)\)/);
assert.match(app, /renderDocumentTopbar\(state,\s*note,\s*state\.uiPreferences,\s*localPersistenceStatus,\s*handleAction\)/);
assert.match(documentTopbarSource, /className:\s*"document-save-status"/);
assert.match(documentTopbarSource, /localPersistenceStatusText\(localPersistenceStatus\)/);
assert.match(documentTopbarSource, /handleAction\("toggle-mode"\)/);
assert.match(documentTopbarSource, /handleAction\("publish"\)/);
assert.match(documentTopbarSource, /className:\s*"document-action-group"/);
assert.match(documentTopbarSource, /icon\("edit",\s*\{\s*size:\s*16\s*\}\)/);
assert.match(documentTopbarSource, /icon\("upload",\s*\{\s*size:\s*16\s*\}\)/);
assert.match(css, /\.document-action-group\s*\{[^}]*min-height:\s*34px/s);
assert.match(css, /\.document-publish-button\s*\{[^}]*min-height:\s*34px/s);
assert.doesNotMatch(documentTopbarSource, /handleAction\("delete-drafts"\)/, "delete drafts should not remain a top-level toolbar action");
assert.match(documentTopbarSource, /h\(DocumentOverflowMenu,/);
assert.match(documentOverflowSource, /const triggerRef = useRef\(null\)/);
assert.match(documentOverflowSource, /const menuRef = useRef\(null\)/);
assert.match(documentOverflowSource, /querySelector\("\[role=menuitem\]:not\(:disabled\)"\)\?\.focus\(\)/);
assert.match(documentOverflowSource, /resolveMenuKeyboard\(currentIndex,\s*event\.key,\s*items\.length\)/);
assert.match(documentOverflowSource, /onKeyDown:\s*handleMenuKeyDown/);
assert.match(documentOverflowSource, /triggerRef\.current\?\.focus\(\)/);
assert.match(documentOverflowSource, /handleAction\("close-document-actions"\)/);
assert.match(documentOverflowSource, /handleAction\(action,\s*note\.id\)/);
assert.match(documentActionsSource, /role:\s*"menu"/);
assert.match(documentActionsSource, /onAction\("rename-note"\)/);
assert.match(documentActionsSource, /onAction\("delete-drafts"\)/);
assert.match(documentActionsSource, /onAction\("delete-note"\)/);
assert.match(app, /state\.uiPreferences\.showOutline\s*\?\s*h\(DocumentOutline/);
assert.match(css, /\.document-topbar\s*\{[^}]*background:\s*var\(--sheet\);/s);
assert.match(css, /\.document-overflow-menu\s*\{[^}]*background:\s*var\(--sheet\);/s);
assert.match(css, /\.feishu-bubble\s*\{[^}]*background:\s*var\(--sheet\);/s);
assert.match(css, /\.feishu-bubble::after\s*\{[^}]*display:\s*none;/s);

const primaryRailSource = ui.slice(ui.indexOf("export function PrimaryRail"), ui.indexOf("export function LibraryHome"));
const settingsSidebarSource = ui.slice(ui.indexOf("export function SettingsSidebar"), ui.indexOf("function settingRow"));
const contextSidebarSource = app.slice(app.indexOf("function renderContextSidebar"), app.indexOf("function renderTree"));
const publishSheetSource = app.slice(app.indexOf("function PublishReviewSheet"), app.indexOf("function renderModal"));

assert.ok(
  contextSidebarSource.includes('"aria-label": "\\u65b0\\u5efa\\u9876\\u7ea7\\u6587\\u4ef6\\u5939"'),
  "the library header plus button should announce top-level folder creation"
);
assert.match(
  contextSidebarSource,
  /className:\s*"sidebar-add-note"[^}]*onClick:\s*\(\)\s*=>\s*handleAction\("new-folder-in-folder",\s*null\)/s,
  "the library header plus button should create a top-level folder"
);

assert.match(primaryRailSource, /h\("nav",\s*\{[^}]*"aria-label":\s*"\u4e3b\u5bfc\u822a"/s);
assert.match(settingsSidebarSource, /h\("nav",\s*\{[^}]*"aria-label":\s*"\u8bbe\u7f6e\u5206\u7c7b"/s);
assert.match(contextSidebarSource, /h\("nav",\s*\{[^}]*className:\s*`sidebar context-sidebar[^`]*`[^}]*"aria-label":\s*"\u77e5\u8bc6\u5e93\u76ee\u5f55"/s);
assert.match(primaryRailSource, /"aria-current":\s*view\s*===\s*target\s*\?\s*"page"\s*:\s*undefined/);
assert.match(contextSidebarSource, /role:\s*"tree"[^}]*"aria-label":\s*"\u6587\u6863\u76ee\u5f55"/s);
assert.match(publishSheetSource, /role:\s*"dialog"/);
assert.match(publishSheetSource, /"aria-modal":\s*"true"/);

assert.match(app, /const \[isContextSidebarOpen,\s*setIsContextSidebarOpen\]\s*=\s*useState\(false\)/);
assert.match(app, /className:\s*"context-sidebar-toggle"/);
assert.match(app, /"aria-controls":\s*"context-sidebar"/);
assert.match(app, /"aria-expanded":\s*isContextSidebarOpen/);
assert.match(app, /"aria-label":\s*isContextSidebarOpen\s*\?\s*"\u5173\u95ed\u76ee\u5f55"\s*:\s*"\u6253\u5f00\u76ee\u5f55"/);
assert.match(app, /h\("span",\s*null,\s*"\u76ee\u5f55"\)/);
assert.match(contextSidebarSource, /id:\s*"context-sidebar"/);
assert.match(contextSidebarSource, /isContextSidebarOpen\s*\?\s*"is-open"\s*:\s*""/);

assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.document-outline[\s\S]*?display:\s*none/);
assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.tag-detail[\s\S]*?display:\s*none/);
assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.app-shell[\s\S]*?grid-template-columns:\s*56px minmax\(0,\s*1fr\)/);
assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.context-sidebar[\s\S]*?position:\s*fixed/);
assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.context-sidebar\.is-open[\s\S]*?transform:\s*translateX\(0\)/);
assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.context-sidebar-toggle[\s\S]*?display:\s*inline-flex/);
assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.primary-rail[\s\S]*?position:\s*fixed[\s\S]*?bottom:\s*0/);
assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.rail-items[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(css, /@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
assert.match(css, /@media\s*\(prefers-contrast:\s*more\)/);
assert.match(app, /className:\s*"mini-action"[^}]*"aria-label":\s*"新建子项"/s);
assert.match(app, /className:\s*"mini-action"[^}]*"aria-label":\s*"更多文档操作"/s);

const narrowDrawerCss = css.slice(css.lastIndexOf("@media (max-width: 900px)"));
assert.match(narrowDrawerCss, /\.context-sidebar\s*\{[^}]*z-index:\s*35/s);
assert.match(narrowDrawerCss, /\.context-sidebar-toggle\s*\{[^}]*z-index:\s*(?:3[6-9]|[4-9]\d)/s, "the visible directory control must remain above its open drawer");
assert.match(
  narrowDrawerCss,
  /\.context-sidebar\.is-open\s+\.sidebar-heading,\s*\.context-sidebar\.is-open\s+\.settings-sidebar-header\s*\{[^}]*padding-left:\s*(?:9[2-9]|[1-9]\d{2,})px/s,
  "an open narrow drawer must reserve enough header space for the directory control"
);

const folderActionSource = app.slice(app.indexOf("function renderFolder"), app.indexOf("function tableSelectionInfo"));
const noteActionSource = app.slice(app.indexOf("function renderNoteItem"), app.indexOf("function buildDraftDeletionSummary"));
assert.match(folderActionSource, /h\(\"button\",\s*\{[^}]*className:\s*"mini-action"[^}]*type:\s*"button"[^}]*"aria-label":\s*"\u65b0\u5efa\u5b50\u9879"/s, "new-child action must be a native keyboard-operable button");
assert.match(noteActionSource, /h\(\"button\",\s*\{[^}]*className:\s*"mini-action"[^}]*type:\s*"button"[^}]*"aria-label":\s*"\u66f4\u591a\u6587\u6863\u64cd\u4f5c"/s, "note-overflow action must be a native keyboard-operable button");
assert.doesNotMatch(folderActionSource, /h\(\"span\",\s*\{[^}]*className:\s*"mini-action"/s, "new-child action must not be nested in the tree-row button");
assert.doesNotMatch(noteActionSource, /h\(\"span\",\s*\{[^}]*className:\s*"mini-action"/s, "note-overflow action must not be nested in the tree-row button");
