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
assert.match(app, /style\.setProperty\("--document-width",\s*`\$\{state\.uiPreferences\.contentWidth\}px`\)/);
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
assert.match(css, /grid-template-columns:\s*56px 260px minmax\(0,\s*1fr\)/);
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
const documentActionsSource = app.slice(app.indexOf("function renderDocumentActionsMenu"), app.indexOf("function documentStatusText"));
assert.match(app, /renderDocumentTopbar\(state,\s*note,\s*state\.uiPreferences,\s*handleAction\)/);
assert.match(documentTopbarSource, /className:\s*"document-save-status"/);
assert.match(documentTopbarSource, /已自动保存/);
assert.match(documentTopbarSource, /handleAction\("toggle-mode"\)/);
assert.match(documentTopbarSource, /handleAction\("toggle-document-actions"\)/);
assert.match(documentTopbarSource, /handleAction\("publish"\)/);
assert.doesNotMatch(documentTopbarSource, /handleAction\("delete-drafts"\)/, "delete drafts should not remain a top-level toolbar action");
assert.match(documentActionsSource, /role:\s*"menu"/);
assert.match(documentActionsSource, /handleAction\("rename-note"/);
assert.match(documentActionsSource, /handleAction\("delete-drafts"\)/);
assert.match(documentActionsSource, /handleAction\("delete-note"/);
assert.match(app, /state\.uiPreferences\.showOutline\s*\?\s*h\(DocumentOutline/);
assert.match(css, /\.document-topbar\s*\{[^}]*background:\s*var\(--sheet\);/s);
assert.match(css, /\.document-overflow-menu\s*\{[^}]*background:\s*var\(--sheet\);/s);
assert.match(css, /\.feishu-bubble\s*\{[^}]*background:\s*var\(--sheet\);/s);
assert.match(css, /\.feishu-bubble::after\s*\{[^}]*display:\s*none;/s);
