# Notebook Library Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current document-first/network-first notebook shell with the approved Library Rail experience: a knowledge-base home, persistent note tree, in-shell tags and settings, a calmer editor, and an Apple-like publish review sheet.

**Architecture:** Keep the existing React-without-build-step application and Tiptap editor. Extract pure navigation, preference, overview, and tag calculations into `static/library-ui-model.mjs`, and extract the new shell/home/tags/settings React views into `static/library-ui.mjs`; retain document editing, publishing, persistence, and GitHub I/O in `static/app.js`. Apply preferences through root `data-*` attributes and CSS custom properties so settings change the existing UI without rewriting editor internals.

**Tech Stack:** React 18 via esm.sh, Tiptap 2, Lucide React icons via esm.sh, CSS, browser localStorage, Node `assert` tests.

## Global Constraints

- Preserve the existing note JSON format, local draft behavior, Tiptap extensions, GitHub Contents API, and selective publish model.
- Default startup view is `home`; `activeId` may be empty and must not be forced to the first note.
- Do not retain the knowledge-network canvas or its full-screen route.
- Do not add recent-note feeds, charts, collaboration, accounts, AI, or backend services.
- Use the system font stack and system blue; controls use 8–12px radii and publish sheets use 18px.
- Use Lucide icons from one pinned version; do not draw icons with text symbols or handcrafted SVG.
- All view changes and controls must remain keyboard accessible and honor reduced motion/transparency.

---

## File Structure

- Create `static/library-ui-model.mjs`: pure preference normalization, startup resolution, library summary, knowledge-area, and tag-browser calculations.
- Create `static/library-ui.mjs`: Lucide icon adapter plus `PrimaryRail`, `LibraryHome`, `TagBrowser`, `SettingsSidebar`, and `SettingsPage` React components.
- Modify `static/app.js`: integrate the new view model and components, change migration/startup rules, wire navigation/settings, simplify the document top bar, and restyle publish markup.
- Modify `static/app.css`: implement the Library Rail shell, semantic tree states, home/tag/settings layouts, editor chrome, publish sheet, responsive behavior, and accessibility media queries.
- Modify `index.html`: update cache-busting versions for the changed script and stylesheet.
- Create `tests/library-ui-model.test.mjs`: pure state and data-model behavior.
- Create `tests/library-shell-ui.test.mjs`: source-level integration contracts for navigation, icons, document selection, settings, and removed network UI.
- Modify `tests/document-outline-layout.test.mjs`: update the outline geometry contract for the approved right-side outline.
- Modify `tests/publish-review-diff-ui.test.mjs`: update publish-sheet labels, structure, and cache-version assertions.

---

### Task 1: Add the pure library UI model

**Files:**
- Create: `static/library-ui-model.mjs`
- Create: `tests/library-ui-model.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_UI_PREFERENCES`, `normalizeUiPreferences(value)`, `resolveStartupState(state, preferences)`, `buildLibrarySummary(folders, notes)`, `buildKnowledgeAreas(folders, notes)`, and `buildTagBrowser(notes, options)`.
- Consumes: plain folder objects `{ id, name, parentId }` and note objects `{ id, title, folderId, tags, date, html }`.

- [ ] **Step 1: Write failing tests for defaults and startup behavior**

```js
import assert from "node:assert/strict";
import {
  DEFAULT_UI_PREFERENCES,
  buildKnowledgeAreas,
  buildLibrarySummary,
  buildTagBrowser,
  normalizeUiPreferences,
  resolveStartupState
} from "../static/library-ui-model.mjs";

assert.deepEqual(normalizeUiPreferences(), DEFAULT_UI_PREFERENCES);
assert.deepEqual(
  resolveStartupState({ view: "library", activeId: "note-1" }, DEFAULT_UI_PREFERENCES),
  { view: "home", activeId: "", selectedTag: "" }
);
assert.deepEqual(
  resolveStartupState(
    { view: "library", activeId: "note-1", selectedTag: "AI" },
    { ...DEFAULT_UI_PREFERENCES, rememberLastLocation: true }
  ),
  { view: "library", activeId: "note-1", selectedTag: "AI" }
);
```

- [ ] **Step 2: Add failing overview and tag-browser assertions**

```js
const folders = [
  { id: "models", name: "模型研究", parentId: null },
  { id: "tools", name: "工程实践", parentId: null }
];
const notes = [
  { id: "vit", title: "ViT", folderId: "models", tags: ["AI", "Vision"], date: "2026-07-31" },
  { id: "bert", title: "BERT", folderId: "models", tags: ["AI", "NLP"], date: "2026-07-30" },
  { id: "docker", title: "Docker", folderId: "tools", tags: ["Tool"], date: "2026-07-29" }
];

assert.deepEqual(buildLibrarySummary(folders, notes), { folders: 2, notes: 3, tags: 4 });
assert.equal(buildKnowledgeAreas(folders, notes)[0].count, 2);
assert.deepEqual(
  buildTagBrowser(notes, { query: "a", sort: "popular", selectedTag: "AI" }).selected.noteIds,
  ["vit", "bert"]
);
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `node tests/library-ui-model.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `static/library-ui-model.mjs`.

- [ ] **Step 4: Implement the pure model**

```js
export const DEFAULT_UI_PREFERENCES = Object.freeze({
  rememberLastLocation: false,
  theme: "auto",
  sidebarDensity: "comfortable",
  translucentMaterials: true,
  contentWidth: 760,
  showOutline: true,
  defaultMode: "read"
});

export function normalizeUiPreferences(value = {}) {
  const contentWidth = Number(value.contentWidth);
  return {
    rememberLastLocation: value.rememberLastLocation === true,
    theme: ["auto", "light", "dark"].includes(value.theme) ? value.theme : "auto",
    sidebarDensity: value.sidebarDensity === "compact" ? "compact" : "comfortable",
    translucentMaterials: value.translucentMaterials !== false,
    contentWidth: Math.min(920, Math.max(640, Number.isFinite(contentWidth) ? contentWidth : 760)),
    showOutline: value.showOutline !== false,
    defaultMode: value.defaultMode === "edit" ? "edit" : "read"
  };
}

export function resolveStartupState(state = {}, preferences = DEFAULT_UI_PREFERENCES) {
  if (preferences.rememberLastLocation) {
    return {
      view: ["home", "library", "tags", "settings"].includes(state.view) ? state.view : "home",
      activeId: state.activeId || "",
      selectedTag: state.selectedTag || ""
    };
  }
  return { view: "home", activeId: "", selectedTag: "" };
}
```

Add `buildLibrarySummary` by counting folders, notes, and distinct normalized tags. Add `buildKnowledgeAreas` by mapping top-level folders to their descendant note counts. Add `buildTagBrowser` by building `{ name, count, noteIds }` records, filtering by the lowercase query, sorting popular tags by descending count then `localeCompare("zh-CN")`, sorting name mode only by `localeCompare("zh-CN")`, and resolving `selected` from the final records or `null`.

- [ ] **Step 5: Run the focused test**

Run: `node tests/library-ui-model.test.mjs`

Expected: PASS with no output.

- [ ] **Step 6: Commit the model**

```bash
git add static/library-ui-model.mjs tests/library-ui-model.test.mjs
git commit -m "feat: add knowledge library view model"
```

---

### Task 2: Build the Library Rail shell and knowledge-base home

**Files:**
- Create: `static/library-ui.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`
- Modify: `index.html`
- Create: `tests/library-shell-ui.test.mjs`

**Interfaces:**
- Consumes: `summary` and `areas` from Task 1; callbacks `onNavigate(view)`, `onCreateNote()`, `onOpenArea(folderId)`, and `onOpenTag(tag)`.
- Produces: `PrimaryRail`, `LibraryHome`, and `icon(name, props)` used by later tasks.

- [ ] **Step 1: Write failing shell contracts**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../static/library-ui.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/app.css", import.meta.url), "utf8");

assert.match(app, /view:\s*"home"/);
assert.match(app, /activeId:\s*""/);
assert.match(app, /h\(PrimaryRail,/);
assert.match(app, /h\(LibraryHome,/);
assert.match(ui, /from "https:\/\/esm\.sh\/lucide-react@0\.468\.0/);
assert.match(ui, /aria-label:\s*label/);
assert.match(css, /grid-template-columns:\s*56px 260px minmax\(0,\s*1fr\)/);
assert.doesNotMatch(app, /NetworkView/);
assert.doesNotMatch(app, /back-network/);
```

- [ ] **Step 2: Run the shell test and verify it fails**

Run: `node tests/library-shell-ui.test.mjs`

Expected: FAIL because `static/library-ui.mjs` does not exist.

- [ ] **Step 3: Create the shared icon and rail components**

```js
import React from "https://esm.sh/react@18.3.1";
import {
  BookOpenText, FileText, Folder, Home, NotebookTabs, Plus,
  Search, Settings, Tag, Trash2
} from "https://esm.sh/lucide-react@0.468.0?external=react";

const h = React.createElement;
const icons = { home: Home, notes: NotebookTabs, tags: Tag, settings: Settings,
  folder: Folder, file: FileText, search: Search, add: Plus, trash: Trash2, library: BookOpenText };

export function icon(name, props = {}) {
  return h(icons[name], { size: 18, strokeWidth: 1.8, "aria-hidden": "true", ...props });
}

export function PrimaryRail({ view, onNavigate }) {
  const items = [["home", "首页"], ["library", "笔记"], ["tags", "标签"], ["settings", "设置"]];
  return h("nav", { className: "primary-rail", "aria-label": "主导航" },
    h("div", { className: "rail-brand", "aria-label": "知识库" }, icon("library")),
    items.map(([target, label]) => h("button", {
      key: target,
      className: `rail-item ${view === target ? "is-active" : ""}`,
      "aria-label": label,
      "aria-current": view === target ? "page" : undefined,
      onClick: () => onNavigate(target)
    }, icon(target === "library" ? "notes" : target), h("span", null, label)))
  );
}
```

- [ ] **Step 4: Add `LibraryHome` and integrate the shell**

In `static/app.js`, import Task 1 and Task 2 exports, change `seed.view` to `"home"`, change `seed.activeId` to `""`, remove the network imports and `NetworkView`, and render:

```js
h("div", { className: "app-shell", "data-view": state.view },
  h(PrimaryRail, { view: state.view, onNavigate: navigate }),
  renderContextSidebar(state, visibleNotes, selectNote, handleAction, treeDrag, dragTarget),
  h("main", { className: "content" },
    state.view === "home"
      ? h(LibraryHome, { summary, areas, tags: tagStats, onCreateNote, onOpenArea, onOpenTag })
      : renderActiveView()
  )
)
```

`navigate("library")` must keep an existing `activeId`; if none exists, show a purposeful empty state with “选择左侧文档开始阅读”. `navigate("home")` clears only transient modal/menu state, not notes or the remembered active document.

- [ ] **Step 5: Add the approved shell and home CSS**

Define `.app-shell` as `grid-template-columns: 56px 260px minmax(0, 1fr)`, remove outer card gaps and traffic-light styles, style `.primary-rail` as the slightly darker material, and add `.library-home`, `.knowledge-area-list`, `.tag-index`, and `.library-summary` layouts. Use row separators for areas and only the three summary items may use subtle contained surfaces.

- [ ] **Step 6: Update cache versions and run tests**

Change every new local import and both `index.html` assets to `v=20260731-library-v1`.

Run:

```powershell
node tests/library-shell-ui.test.mjs
node --check static/app.js
Get-ChildItem tests\*.test.mjs | ForEach-Object { node $_.FullName }
```

Expected: all commands exit 0 after updating old cache-version assertions.

- [ ] **Step 7: Commit the shell and home**

```bash
git add static/library-ui.mjs static/app.js static/app.css index.html tests/library-shell-ui.test.mjs tests/publish-review-diff-ui.test.mjs
git commit -m "feat: add knowledge library home shell"
```

---

### Task 3: Make the tree semantic and add the in-shell tag browser

**Files:**
- Modify: `static/library-ui.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`
- Modify: `tests/library-shell-ui.test.mjs`
- Modify: `tests/library-ui-model.test.mjs`

**Interfaces:**
- Consumes: `buildTagBrowser(notes, { query, sort, selectedTag })` from Task 1 and `icon()` from Task 2.
- Produces: `TagBrowser({ model, onQuery, onSort, onSelectTag, onOpenNote, onCreateTag })`.

- [ ] **Step 1: Add failing semantic-tree and tag-view assertions**

Add assertions that the tree markup contains `tree-folder-icon`, `tree-note-icon`, `aria-current: isActive ? "page"`, and that the UI module exports `TagBrowser`. Add a model assertion proving alphabetical sorting returns `AI`, `NLP`, `Tool`, `Vision`.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```powershell
node tests/library-ui-model.test.mjs
node tests/library-shell-ui.test.mjs
```

Expected: FAIL on the new tree and `TagBrowser` assertions.

- [ ] **Step 3: Replace tree glyphs with Lucide icons and explicit states**

Update `renderTree` so folder rows render `icon("folder", { className: "tree-folder-icon" })`, document rows render `icon("file", { className: "tree-note-icon" })`, and active document buttons set `aria-current="page"`. Keep existing drag handlers, indentation classes, menus, and collapsed-folder state unchanged.

- [ ] **Step 4: Implement and wire the tag browser**

The component must render search, `popular`/`name` segmented controls, a common-tags group, all tags, and a selected-tag detail pane. Change `enterTag` to set `view = "tags"` without assigning the only matching note to `activeId`. `onOpenNote(id)` calls the existing `selectNote(id)` and stores `tagReturnContext` so the Back control can return to the selected tag.

```js
export function TagBrowser({ model, onQuery, onSort, onSelectTag, onOpenNote }) {
  return h("section", { className: "tag-browser" },
    h("header", { className: "view-header" }, h("div", null,
      h("h1", null, "标签"),
      h("p", null, "用主题连接散落在不同目录里的知识。")
    )),
    h("div", { className: "tag-browser-grid" },
      renderTagIndex(model, onQuery, onSort, onSelectTag),
      renderTagDetail(model.selected, model.notesById, onOpenNote)
    )
  );
}
```

- [ ] **Step 5: Add tag and tree styling**

Use separate folder/document icon colors, 40px comfortable rows, 34px compact rows, a 3px active rail, a full-row active background, and no hover translation. Use a two-column tag content layout that collapses to one column below 1100px.

- [ ] **Step 6: Run focused and full tests**

Run:

```powershell
node tests/library-ui-model.test.mjs
node tests/library-shell-ui.test.mjs
Get-ChildItem tests\*.test.mjs | ForEach-Object { node $_.FullName }
```

Expected: all tests exit 0.

- [ ] **Step 7: Commit semantic navigation**

```bash
git add static/library-ui.mjs static/app.js static/app.css tests/library-shell-ui.test.mjs tests/library-ui-model.test.mjs
git commit -m "feat: add semantic notebook tree and tags"
```

---

### Task 4: Add persistent, functional settings

**Files:**
- Modify: `static/library-ui.mjs`
- Modify: `static/app.js`
- Modify: `static/app.css`
- Modify: `tests/library-ui-model.test.mjs`
- Modify: `tests/library-shell-ui.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_UI_PREFERENCES`, `normalizeUiPreferences`, and `resolveStartupState` from Task 1.
- Produces: `SettingsSidebar` and `SettingsPage`; persisted key `personal-notebook-ui-preferences-v1`.

- [ ] **Step 1: Add failing normalization and settings contracts**

Test clamping `contentWidth` to 640–920, invalid theme fallback to `auto`, and compact density preservation. Assert the UI source includes the seven approved setting categories, while the app source includes `uiPreferencesStorageKey` and root `data-theme`, `data-density`, and `data-transparency` assignments.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
node tests/library-ui-model.test.mjs
node tests/library-shell-ui.test.mjs
```

Expected: FAIL on the missing settings UI and root attributes.

- [ ] **Step 3: Add preferences state and persistence**

```js
const uiPreferencesStorageKey = "personal-notebook-ui-preferences-v1";

function loadUiPreferences() {
  try {
    return normalizeUiPreferences(JSON.parse(localStorage.getItem(uiPreferencesStorageKey) || "{}"));
  } catch {
    return normalizeUiPreferences();
  }
}
```

Initialize preferences independently from notebook data. Persist them in their own effect. On mount, apply `document.documentElement.dataset.theme`, `.density`, `.transparency`, and CSS variable `--document-width`. Resolve the startup view once from the loaded preference; do not re-run startup resolution on every state change.

- [ ] **Step 4: Implement settings navigation and controls**

`SettingsSidebar` renders exactly: 通用、外观、阅读与编辑、数据与同步、GitHub 发布、快捷键、关于. `SettingsPage` renders native-style grouped rows. General includes startup behavior; Appearance includes theme, density, and transparency; Reading includes width, outline, and default mode; GitHub Publish reuses the existing owner/repo/token fields without rendering the token outside an editable password input.

- [ ] **Step 5: Make settings visibly effective**

Add selectors for `[data-theme="dark"]`, `[data-density="compact"]`, and `[data-transparency="solid"]`. Gate the outline rendering with `preferences.showOutline`, set the paper/editor max width from `--document-width`, and use `preferences.defaultMode` when selecting a note or creating a new one.

- [ ] **Step 6: Run focused and full tests**

Run:

```powershell
node tests/library-ui-model.test.mjs
node tests/library-shell-ui.test.mjs
node --check static/app.js
Get-ChildItem tests\*.test.mjs | ForEach-Object { node $_.FullName }
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit settings**

```bash
git add static/library-ui.mjs static/library-ui-model.mjs static/app.js static/app.css tests/library-ui-model.test.mjs tests/library-shell-ui.test.mjs
git commit -m "feat: add notebook appearance settings"
```

---

### Task 5: Polish the reading and editing workspace

**Files:**
- Modify: `static/app.js`
- Modify: `static/app.css`
- Modify: `tests/document-outline-layout.test.mjs`
- Modify: `tests/library-shell-ui.test.mjs`

**Interfaces:**
- Consumes: preferences from Task 4 and existing `DocumentPaper`, Tiptap selection bubble, block menu, table tools, and outline extraction.
- Produces: new `renderDocumentTopbar(state, note, preferences, handleAction)` behavior and a right-side optional outline.

- [ ] **Step 1: Replace old layout assertions with approved editor contracts**

Assert that `.document-workspace` uses `minmax(0, var(--document-width)) 196px`, that the outline is absent when `showOutline` is false, that the top bar includes `已自动保存`, and that `delete-drafts` is no longer a top-level toolbar button.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```powershell
node tests/document-outline-layout.test.mjs
node tests/library-shell-ui.test.mjs
```

Expected: FAIL on workspace order, save copy, and toolbar structure.

- [ ] **Step 3: Rebuild the document top bar**

Render breadcrumb on the left, status in a center/secondary slot, and controls on the right: 阅读/编辑, overflow, 发表. Move rename, delete drafts, and destructive actions into an accessible overflow menu. Keep publish disabled while `syncStatus === "publishing"`.

- [ ] **Step 4: Move the outline to the right and retain editor tools**

Change workspace order to document then outline. Preserve the existing selection bubble, plus menu, drag handle, code/table actions, and scroll-linked active heading. Apply `preferences.showOutline` before rendering the outline; do not remove outline calculation because it remains needed when re-enabled.

- [ ] **Step 5: Apply the approved editor styling**

Remove the large paper card shadow and excessive rounded container. Keep the editor surface warm white, limit it with `--document-width`, use a hairline top toolbar, and style the bubble menu as a small translucent anchored material. Ensure the current document stays visibly selected in the tree in both read and edit modes.

- [ ] **Step 6: Run focused and full tests**

Run:

```powershell
node tests/document-outline-layout.test.mjs
node tests/library-shell-ui.test.mjs
Get-ChildItem tests\*.test.mjs | ForEach-Object { node $_.FullName }
```

Expected: all tests exit 0.

- [ ] **Step 7: Commit the editor polish**

```bash
git add static/app.js static/app.css tests/document-outline-layout.test.mjs tests/library-shell-ui.test.mjs
git commit -m "feat: refine notebook reading and editing"
```

---

### Task 6: Convert publishing to the approved review sheet

**Files:**
- Modify: `static/app.js`
- Modify: `static/app.css`
- Modify: `tests/publish-review-diff-ui.test.mjs`
- Modify: `tests/publish-model.test.mjs`

**Interfaces:**
- Consumes: existing `buildPublishChangeSet`, `buildPublishChangeDetails`, `validatePublishSelection`, `mergeSelectedPublishState`, and `publishSelectedChanges`.
- Produces: sheet markup classes `publish-sheet`, `publish-destination`, `publish-change-list`, `publish-tags`, and `publish-sheet-footer`.

- [ ] **Step 1: Add failing publish-sheet assertions**

Assert the source includes “发表到 GitHub”, repository/branch labels, “本次变更”, “公开标签”, “查看发布差异”, “未选中的改动会继续保留为本地草稿”, and “确认发表”. Assert the CSS animates `.publish-sheet` from the top-right transform origin and provides a reduced-motion cross-fade.

- [ ] **Step 2: Run the publish tests and verify failure**

Run:

```powershell
node tests/publish-review-diff-ui.test.mjs
node tests/publish-model.test.mjs
```

Expected: the model test passes; the UI test fails on the new copy and classes.

- [ ] **Step 3: Rebuild only the publish-review markup**

Keep the current review data and checkbox IDs. Add a destination row using `state.settings.owner`, `repo`, and `branch`; group change rows under “本次变更”; derive visible public tags from selected note changes; keep each existing `<details>` diff and relabel its summary “查看发布差异”. Footer shows selected count, Cancel, and Confirm Publish.

- [ ] **Step 4: Preserve publishing behavior and add safe status feedback**

Do not change validation or merge semantics. Disable only the confirm button while publishing; on success close the sheet and call `setToast("已发表到 GitHub")`; on failure keep `modal === "publish-review"`, preserve selections in `modalContext.review.selectedIds`, and show the error inside the sheet.

- [ ] **Step 5: Add material and motion styling**

Use an 18px opaque/frosted sheet, one shadow, dim backdrop, `transform-origin: calc(100% - 80px) 0`, and a 200–240ms critically damped-looking scale/fade. Under reduced motion, remove transform and use opacity only.

- [ ] **Step 6: Run publish and full regression tests**

Run:

```powershell
node tests/publish-review-diff-ui.test.mjs
node tests/publish-model.test.mjs
Get-ChildItem tests\*.test.mjs | ForEach-Object { node $_.FullName }
```

Expected: all tests exit 0.

- [ ] **Step 7: Commit the publish sheet**

```bash
git add static/app.js static/app.css tests/publish-review-diff-ui.test.mjs tests/publish-model.test.mjs
git commit -m "feat: redesign publish review sheet"
```

---

### Task 7: Responsive, accessibility, and visual verification

**Files:**
- Modify: `static/app.css`
- Modify: `static/app.js`
- Modify: `tests/library-shell-ui.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: all completed views and preferences.
- Produces: final verified desktop and narrow-screen implementation.

- [ ] **Step 1: Add failing accessibility and responsive contracts**

Assert named nav landmarks, `aria-current` on active rail/tree items, `aria-modal="true"` and `role="dialog"` on the publish sheet, and CSS coverage for `max-width: 1100px`, `max-width: 900px`, `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast: more`.

- [ ] **Step 2: Run the shell test and verify failure**

Run: `node tests/library-shell-ui.test.mjs`

Expected: FAIL on any missing landmark, dialog, or media-query contract.

- [ ] **Step 3: Complete responsive and accessibility behavior**

At 1100px hide/collapse the document outline and tag detail column. At 900px turn the context sidebar into a toggled drawer, keep the 56px rail, and add a visible “目录” control. At 640px pin the primary destinations to a bottom rail and let the drawer/main content fill the viewport. Trap focus inside the publish sheet, close it with Escape, restore focus to the Publish button, and label all icon-only controls.

- [ ] **Step 4: Update README behavior documentation**

Replace knowledge-network references with knowledge-base home and tag browser behavior. Document the startup preference and note that publishing remains selective and GitHub-backed.

- [ ] **Step 5: Run the complete automated verification**

Run:

```powershell
node --check static/app.js
Get-ChildItem tests\*.test.mjs | ForEach-Object { node $_.FullName }
git diff --check
```

Expected: every command exits 0 and `git diff --check` prints nothing.

- [ ] **Step 6: Perform browser visual verification**

Start `python server.py`, reload the local app, and inspect these exact states at the normal desktop viewport: fresh knowledge-base home, tags with AI selected, General settings, ViT edit mode with text selected, and publish review. For each state verify no clipping, tree selection visibility, consistent columns, correct icons, readable Chinese, and working primary controls. Repeat at widths near 1100px, 900px, and 640px, then verify reduced-motion mode uses cross-fades.

- [ ] **Step 7: Commit final polish**

```bash
git add static/app.js static/app.css tests/library-shell-ui.test.mjs README.md
git commit -m "feat: complete notebook library redesign"
```
