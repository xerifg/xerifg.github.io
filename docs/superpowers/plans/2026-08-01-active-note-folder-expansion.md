# 当前文档目录自动展开 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 默认折叠笔记目录，并仅自动展开当前文档的父文件夹路径。

**Architecture:** 在目录模型中提供两个纯函数：首次初始化时折叠所有文件夹并打开活动文档的路径；切换文档时只打开新路径，不收起用户手动打开的路径。应用状态使用持久化初始化标记，避免后续刷新覆盖用户手动的展开选择。

**Tech Stack:** 原生 ES modules、React、Node.js 内置 `assert`。

## Global Constraints

- 目录搜索时继续临时展开匹配路径。
- 手动展开和折叠状态必须随现有本地持久化保存。
- 不修改目录渲染组件的 DOM 结构或键盘交互。

---

### Task 1: 建立目录展开状态的纯函数

**Files:**
- Modify: `tests/library-interactions.test.mjs`
- Modify: `static/library-ui-model.mjs`

**Interfaces:**
- Produces: `defaultCollapsedFolders(folders, notes, activeId)` 与 `revealNoteFolderPath(collapsedFolders, folders, notes, activeId)`。

- [ ] **Step 1: Write the failing test**

为嵌套目录 `root -> child` 与两篇文档增加断言：无活动文档时 `root`、`child` 都折叠；活动文档在 `child` 时两级均展开；已手动展开的无关文件夹仍保持展开。

- [ ] **Step 2: Run test to verify it fails**

Run: `& 'C:\Users\ethan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\library-interactions.test.mjs`

Expected: FAIL because the new helper exports do not exist.

- [ ] **Step 3: Write minimal implementation**

实现两个纯函数，使用 `folder.parentId` 自活动文档 `folderId` 向根目录回溯；前者先标记所有文件夹折叠，后者仅删除路径中的折叠标记。

- [ ] **Step 4: Run test to verify it passes**

Run: `& 'C:\Users\ethan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\library-interactions.test.mjs`

Expected: PASS with exit code 0.

### Task 2: 将目录展开规则接入应用状态

**Files:**
- Modify: `static/app.js:24,354,400-430,625-640,4300-4370`
- Test: `tests/library-shell-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 的两个目录状态函数。
- Produces: 首次状态恢复默认折叠；选择笔记时展开其路径；已初始化的折叠状态在远端内容加载时保留。

- [ ] **Step 1: Write the failing test**

在壳层测试中断言 `app.js` 导入两个模型函数，状态包含 `folderExpansionInitialized`，选择笔记时调用 `revealNoteFolderPath`。

- [ ] **Step 2: Run test to verify it fails**

Run: `& 'C:\Users\ethan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\library-shell-ui.test.mjs`

Expected: FAIL because状态接入尚不存在。

- [ ] **Step 3: Write minimal implementation**

给种子状态添加 `folderExpansionInitialized: false`。在 `migrate` 中，未初始化的状态调用 `defaultCollapsedFolders` 并设为已初始化；已初始化状态保留合法的现有 `collapsedFolders`。在 `selectNote` 中以 `revealNoteFolderPath` 更新折叠状态，并在发布库加载的状态合并中保留该两项字段。

- [ ] **Step 4: Run focused tests**

Run: `& 'C:\Users\ethan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\library-interactions.test.mjs; & 'C:\Users\ethan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\library-shell-ui.test.mjs`

Expected: both PASS.

- [ ] **Step 5: Run full suite**

Run: `$nodeExe = 'C:\Users\ethan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; Get-ChildItem tests -Filter *.test.mjs | ForEach-Object { & $nodeExe $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`

Expected: every test exits successfully.
