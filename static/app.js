import React, { useCallback, useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { Editor, Node, mergeAttributes } from "https://esm.sh/@tiptap/core@2.11.7";
import katex from "https://esm.sh/katex@0.16.22";
import mermaid from "https://esm.sh/mermaid@11.12.0";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.11.7";
import CodeBlock from "https://esm.sh/@tiptap/extension-code-block@2.11.7";
import Underline from "https://esm.sh/@tiptap/extension-underline@2.11.7";
import Link from "https://esm.sh/@tiptap/extension-link@2.11.7";
import Highlight from "https://esm.sh/@tiptap/extension-highlight@2.11.7";
import TextStyle from "https://esm.sh/@tiptap/extension-text-style@2.11.7";
import Color from "https://esm.sh/@tiptap/extension-color@2.11.7";
import Image from "https://esm.sh/@tiptap/extension-image@2.11.7";
import Placeholder from "https://esm.sh/@tiptap/extension-placeholder@2.11.7";
import Table from "https://esm.sh/@tiptap/extension-table@2.11.7";
import TableRow from "https://esm.sh/@tiptap/extension-table-row@2.11.7";
import TableHeader from "https://esm.sh/@tiptap/extension-table-header@2.11.7";
import TableCell from "https://esm.sh/@tiptap/extension-table-cell@2.11.7";
import TaskList from "https://esm.sh/@tiptap/extension-task-list@2.11.7";
import TaskItem from "https://esm.sh/@tiptap/extension-task-item@2.11.7";
import {
  Bold, Braces, Check, ChevronDown, Code2, FileUp, Heading1, Heading2, Heading3, Image as ImageIcon,
  GitBranch, Italic, Link as LinkIcon, List, ListOrdered, Minus, Quote, Sigma, Strikethrough,
  Table as TableIcon, Type, Underline as UnderlineIcon, Video as VideoIcon, X, Ellipsis
} from "https://esm.sh/lucide-react@0.468.0?external=react";
import { applyTreeDrop } from "./tree-dnd.mjs";
import { sortTableRows } from "./table-model.mjs";
import { assignSelectedPublishFiles, buildMissingRemoteNote, buildPublishChangeDetails, buildPublishChangeSet, mergeSelectedPublishState, reconcilePublishedNotes, validatePublishSelection } from "./publish-model.mjs?v=20260731-library-v1";
import { DEFAULT_UI_PREFERENCES, applyLocalTagMutation, applyNoteTagMutation, applyTagOrder, normalizeUiPreferences, resolveStartupState, buildLibrarySummary, buildKnowledgeAreas, buildTagBrowser, buildTagReturnContext, buildVisibleTreeItems, defaultCollapsedFolders, enterTagView, groupTagRecords, localPersistenceStatusText, navigatePrimaryView, notebookStateForPersistence, revealNoteFolderPath, resolveLocalPersistenceStatus, resolveMenuKeyboard, resolvePublishReviewReturnTarget, resolveTreeKeyboard, toggleContextDrawer, restoreTagView } from "./library-ui-model.mjs?v=20260801-note-tag-actions-v1";
import { LibraryHome, PrimaryRail, SettingsPage, SettingsSidebar, TagBrowser, icon } from "./library-ui.mjs?v=20260731-library-v1";

const h = React.createElement;
const storageKey = "personal-notebook-tiptap-v1";
const uiPreferencesStorageKey = "personal-notebook-ui-preferences-v1";
const blockNoteStorageKey = "personal-notebook-blocknote-v1";
const legacyStorageKey = "personal-notebook-v2";
const publishedIndexPath = "notebooks/index.json";
const localAssetPrefix = "/api/local-assets/";
const assetRootPath = "notebooks/assets";
const publishTriggerSelector = "[data-publish-trigger]";
const now = () => new Date().toISOString();
const mathInlineType = "mathInline";
const mathBlockType = "mathBlock";
const mermaidDiagramType = "mermaidDiagram";
const mermaidExample = `graph TD
  %% 支持完整 Mermaid 源码
  subgraph Input_Stage [输入数据]
         RawPoints[原始点云] --> InputTensor[输入张量]
         end
         InputTensor --> Encoder[特征编码]
         UT1[上采样特征 1] & UT2[上采样特征 2] & UT3[上采样特征 3] --> Concat[多尺度拼接]
         classDef inputStyle fill:#fff3e0,stroke:#ff9800,stroke-width:2px;
         class RawPoints,InputTensor inputStyle;
  Encoder --> Output[输出]`;

mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

const tableCellStyleAttributes = {
  backgroundColor: {
    default: null,
    parseHTML: (element) => element.style.backgroundColor || null,
    renderHTML: (attributes) => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {}
  },
  textAlign: {
    default: "left",
    parseHTML: (element) => element.style.textAlign || "left",
    renderHTML: (attributes) => attributes.textAlign && attributes.textAlign !== "left" ? { style: `text-align: ${attributes.textAlign}` } : {}
  },
  verticalAlign: {
    default: "top",
    parseHTML: (element) => element.style.verticalAlign || "top",
    renderHTML: (attributes) => attributes.verticalAlign && attributes.verticalAlign !== "top" ? { style: `vertical-align: ${attributes.verticalAlign}` } : {}
  }
};

const StyledTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...tableCellStyleAttributes };
  }
});

const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...tableCellStyleAttributes };
  }
});

const MathInline = Node.create({
  name: mathInlineType,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      tex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-tex") || element.textContent || "",
        renderHTML: (attributes) => ({ "data-tex": attributes.tex || "" })
      }
    };
  },
  parseHTML() {
    return [{ tag: "span[data-type='math-inline']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, {
      "data-type": "math-inline",
      class: "math-node math-inline"
    }), HTMLAttributes.tex || ""];
  },
  addNodeView() {
    return ({ node }) => createMathNodeView(node, false);
  }
});

const MathBlock = Node.create({
  name: mathBlockType,
  group: "block",
  atom: true,
  selectable: true,
  isolating: true,
  addAttributes() {
    return {
      tex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-tex") || element.textContent || "",
        renderHTML: (attributes) => ({ "data-tex": attributes.tex || "" })
      }
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='math-block']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, {
      "data-type": "math-block",
      class: "math-node math-block"
    }), HTMLAttributes.tex || ""];
  },
  addNodeView() {
    return ({ node }) => createMathNodeView(node, true);
  }
});

const MermaidDiagram = Node.create({
  name: mermaidDiagramType,
  group: "block",
  atom: true,
  selectable: true,
  isolating: true,
  addAttributes() {
    return {
      code: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mermaid-code") || "",
        renderHTML: (attributes) => ({ "data-mermaid-code": attributes.code || "" })
      },
      error: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mermaid-error") || "",
        renderHTML: (attributes) => attributes.error ? { "data-mermaid-error": attributes.error } : {}
      }
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='mermaid-diagram']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, {
      "data-type": "mermaid-diagram",
      class: "mermaid-diagram"
    })];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => createMermaidDiagramNodeView(node, getPos, editor);
  }
});

function createMermaidDiagramNodeView(node, getPos, editor) {
  const dom = document.createElement("div");
  dom.className = "mermaid-diagram";
  dom.dataset.type = "mermaid-diagram";
  const mount = document.createElement("div");
  dom.append(mount);
  const root = createRoot(mount);
  const render = (current) => root.render(h(MermaidDiagramView, { node: current, updateAttributes: (attrs) => {
    const position = typeof getPos === "function" ? getPos() : null;
    if (typeof position === "number") editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, ...attrs }));
  } }));
  render(node);
  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type.name !== mermaidDiagramType) return false;
      render(updatedNode);
      return true;
    },
    destroy() { root.unmount(); },
    stopEvent: (event) => Boolean(event.target?.closest?.(".mermaid-diagram"))
  };
}

function MermaidDiagramView({ node, updateAttributes }) {
  const [editing, setEditing] = useState(false);
  return h("section", { className: `mermaid-diagram-card${editing ? " is-editing" : ""}` },
    h("div", { className: "mermaid-diagram-toolbar", contentEditable: false },
      h("span", { className: "mermaid-diagram-title" }, "Mermaid 图表"),
      h("button", { type: "button", onClick: () => setEditing((value) => !value) }, editing ? "完成编辑" : "编辑源码")
    ),
    h(MermaidPreview, { code: node.attrs.code, error: node.attrs.error, onRenderError: (error) => updateAttributes({ error }), onRenderSuccess: () => node.attrs.error && updateAttributes({ error: "" }) }),
    editing ? h("div", { className: "mermaid-source-panel" },
      h("textarea", {
        value: node.attrs.code,
        spellCheck: false,
        "aria-label": "Mermaid 源码",
        onChange: (event) => updateAttributes({ code: event.target.value, error: "" })
      })
    ) : null
  );
}

function MermaidPreview({ code, error, onRenderError, onRenderSuccess }) {
  const previewRef = useRef(null);
  const [renderError, setRenderError] = useState("");
  const [lastSuccessfulSvg, setLastSuccessfulSvg] = useState("");
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!previewRef.current || !code) return;
      try {
        const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, code);
        if (!cancelled && previewRef.current) {
          previewRef.current.replaceChildren();
          previewRef.current.insertAdjacentHTML("afterbegin", svg);
          setLastSuccessfulSvg(svg);
          setRenderError("");
          onRenderSuccess?.();
        }
      } catch {
        if (!cancelled) {
          const message = "Mermaid 无法渲染当前源码，请检查语法。";
          setRenderError(message);
          onRenderError?.(message);
        }
      }
    };
    render();
    return () => { cancelled = true; };
  }, [code]);
  return h("div", { className: "mermaid-diagram-preview" },
    h("div", { ref: previewRef, dangerouslySetInnerHTML: lastSuccessfulSvg ? { __html: lastSuccessfulSvg } : undefined }),
    error || renderError ? h("p", { className: "mermaid-diagram-error", role: "alert" }, error || renderError) : null
  );
}

function createMathNodeView(node, displayMode) {
  const dom = document.createElement(displayMode ? "div" : "span");
  dom.className = "math-node " + (displayMode ? "math-block" : "math-inline");
  dom.dataset.type = displayMode ? "math-block" : "math-inline";
  dom.dataset.tex = node.attrs.tex || "";
  renderMathElement(dom, displayMode);
  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type.name !== node.type.name) return false;
      dom.dataset.tex = updatedNode.attrs.tex || "";
      renderMathElement(dom, displayMode);
      return true;
    }
  };
}

const NotebookCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      wrapped: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-wrapped") === "true",
        renderHTML: (attributes) => attributes.wrapped ? { "data-wrapped": "true" } : {}
      }
    };
  },
  addNodeView() {
    return ({ node }) => {
      let currentNode = node;
      const { dom, contentDOM, syncLineNumbers } = createEnhancedCodeBlockElement({
        wrapped: Boolean(node.attrs.wrapped),
        getCodeText: () => currentNode.textContent
      });
      syncLineNumbers();
      return {
        dom,
        contentDOM,
        update(updatedNode) {
          if (updatedNode.type.name !== node.type.name) return false;
          currentNode = updatedNode;
          dom.classList.toggle("is-wrapped", Boolean(updatedNode.attrs.wrapped));
          window.requestAnimationFrame(syncLineNumbers);
          return true;
        },
        ignoreMutation(mutation) {
          const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
          return target?.closest(".notebook-code-toolbar, .notebook-code-gutter") !== null;
        }
      };
    };
  }
});

function createEnhancedCodeBlockElement(options = {}) {
  const dom = document.createElement("pre");
  dom.className = "notebook-code-block";
  dom.classList.toggle("is-wrapped", Boolean(options.wrapped));
  const header = document.createElement("div");
  header.className = "notebook-code-header";
  const collapseButton = document.createElement("button");
  collapseButton.type = "button";
  collapseButton.className = "notebook-code-title notebook-code-toolbar";
  collapseButton.setAttribute("aria-expanded", "true");
  collapseButton.title = "\u6298\u53e0\u4ee3\u7801\u5757";
  const disclosure = document.createElement("span");
  disclosure.className = "notebook-code-disclosure";
  disclosure.textContent = "\u25be";
  const titleText = document.createElement("span");
  titleText.textContent = "\u4ee3\u7801\u5757";
  collapseButton.append(disclosure, titleText);
  const actions = document.createElement("div");
  actions.className = "notebook-code-actions notebook-code-toolbar";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "\u590d\u5236";
  copyButton.title = "\u590d\u5236\u4ee3\u7801";
  actions.append(copyButton);
  header.append(collapseButton, actions);
  const body = document.createElement("div");
  body.className = "notebook-code-body";
  const gutter = document.createElement("div");
  gutter.className = "notebook-code-gutter";
  const contentDOM = document.createElement("code");
  contentDOM.className = "notebook-code-content";
  body.append(gutter, contentDOM);
  dom.append(header, body);
  const syncCollapsedState = () => {
    const isCollapsed = dom.classList.contains("is-collapsed");
    collapseButton.setAttribute("aria-expanded", String(!isCollapsed));
    disclosure.textContent = isCollapsed ? "\u25b8" : "\u25be";
  };
  const codeText = () => options.getCodeText?.() ?? contentDOM.textContent ?? "";
  const syncLineNumbers = () => {
    const text = codeText();
    const count = Math.max(1, (text.match(/\n/g) || []).length + 1);
    gutter.replaceChildren(...Array.from({ length: count }, (_, index) => {
      const line = document.createElement("span");
      line.textContent = String(index + 1);
      return line;
    }));
  };
  collapseButton.addEventListener("mousedown", (event) => event.preventDefault());
  collapseButton.addEventListener("click", (event) => {
    event.preventDefault();
    dom.classList.toggle("is-collapsed");
    syncCollapsedState();
  });
  copyButton.addEventListener("mousedown", (event) => event.preventDefault());
  copyButton.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await copyTextToClipboard(codeText());
      copyButton.textContent = "\u5df2\u590d\u5236";
      window.setTimeout(() => { copyButton.textContent = "\u590d\u5236"; }, 1200);
    } catch {
      copyButton.textContent = "\u590d\u5236\u5931\u8d25";
      window.setTimeout(() => { copyButton.textContent = "\u590d\u5236"; }, 1200);
    }
  });
  syncCollapsedState();
  return { dom, contentDOM, syncLineNumbers };
}

function enhanceReaderCodeBlocks(root) {
  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.classList.contains("notebook-code-block") && pre.querySelector(".notebook-code-content")) return;
    const originalCode = pre.querySelector("code");
    const text = originalCode ? originalCode.textContent : pre.textContent;
    const wrapped = pre.getAttribute("data-wrapped") === "true" || pre.classList.contains("is-wrapped");
    const enhanced = createEnhancedCodeBlockElement({ wrapped });
    enhanced.contentDOM.textContent = text || "";
    enhanced.syncLineNumbers();
    pre.replaceWith(enhanced.dom);
  });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}
const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: {
        default: true,
        parseHTML: (element) => element.hasAttribute("controls"),
        renderHTML: (attributes) => attributes.controls === false ? {} : { controls: "" }
      },
      title: { default: null }
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes)];
  }
});

const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.querySelector("a")?.getAttribute("href") || null
      },
      name: {
        default: "附件",
        parseHTML: (element) => element.querySelector("a")?.getAttribute("download")
          || element.querySelector("a")?.textContent?.replace(/^附件：/, "").trim()
          || "附件"
      },
      size: {
        default: "",
        parseHTML: (element) => element.querySelector("span")?.textContent || ""
      }
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='file-attachment']" }];
  },
  renderHTML({ HTMLAttributes }) {
    const href = HTMLAttributes.href || "#";
    const name = HTMLAttributes.name || "附件";
    const size = HTMLAttributes.size || "";
    return ["div", { "data-type": "file-attachment", class: "doc-attachment-card" },
      ["a", mergeAttributes({ class: "doc-attachment", href, download: name }, { href }), `附件：${name}`],
      ["span", {}, size]
    ];
  }
});

const seedHtml = [
  "<h2>记录方式</h2>",
  "<p>这里是一套纯笔记系统。左侧像飞书文档一样管理文件夹和文档，右侧默认是阅读模式。</p>",
  "<p>现在编辑器已经切换为 Tiptap/ProseMirror，并自定义了飞书式加号菜单和选区工具条。编辑会先自动保存到浏览器本地草稿，点击「发表」后才会写入 GitHub 仓库。</p>",
  "<h2>保存方式</h2>",
  "<p>首次编辑或发表前，会弹出账号和密码验证。验证通过后，文档会保存到当前笔记本 GitHub 仓库的 main 分支。</p>"
].join("");

const seed = {
  query: "",
  view: "home",
  selectedTag: "",
  settingsCategory: "general",
  tagQuery: "",
  tagSort: "popular",
  tagReturnContext: null,
  authenticated: false,
  pendingAuthAction: "",
  mode: "read",
  activeId: "",
  modal: null,
  modalContext: null,
  openCreateMenu: null,
  collapsedFolders: {},
  folderExpansionInitialized: false,
  deletedTags: [],
  syncStatus: "ready",
  message: "",
  settings: {
    account: inferOwner(),
    owner: inferOwner(),
    repo: inferRepo(),
    branch: "main",
    token: ""
  },
  folders: [
    { id: "folder-writing", name: "写作台", parentId: null },
    { id: "folder-system", name: "使用说明", parentId: "folder-writing" }
  ],
  notes: [
    {
      id: "note-welcome",
      title: "个人知识库起点",
      folderId: "folder-system",
      tags: ["知识库", "Tiptap", "GitHub"],
      date: now(),
      file: "notebooks/docs/welcome.json",
      dirty: false,
      publishedAt: "",
      assets: [],
      html: seedHtml
    }
  ]
};

function App() {
  const [state, setState] = useState(() => {
    const migrated = migrate(loadLocalState() || seed);
    const uiPreferences = loadUiPreferences();
    return { ...migrated, ...resolveStartupState(migrated, uiPreferences), uiPreferences };
  });
  const [toast, setToast] = useState("");
  const [localPersistenceStatus, setLocalPersistenceStatus] = useState("saved");
  const [dragTarget, setDragTarget] = useState(null);
  const [draggedTreeItem, setDraggedTreeItem] = useState(null);
  const [isContextSidebarOpen, setIsContextSidebarOpen] = useState(false);
  const [treeFocusId, setTreeFocusId] = useState("");
  const notebookPersistencePayload = JSON.stringify(notebookStateForPersistence(state));

  useEffect(() => {
    let cancelled = false;
    loadPublishedLibrary()
      .then((published) => {
        if (cancelled || !published) return;
        const local = migrate(loadLocalState() || {});
        const shouldKeepLocal = local.notes?.some((note) => note.dirty);
        if (!shouldKeepLocal) {
          setState((current) => migrate({
            ...published,
            view: current.view,
            activeId: current.activeId,
            selectedTag: current.selectedTag,
            tagQuery: current.tagQuery,
            tagSort: current.tagSort,
            tagReturnContext: current.tagReturnContext,
            query: current.query,
            collapsedFolders: current.collapsedFolders,
            folderExpansionInitialized: current.folderExpansionInitialized,
            uiPreferences: current.uiPreferences,
            settings: { ...current.settings, token: current.settings.token }
          }));
        }
      })
      .catch((error) => console.warn("Published library load failed", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let savedTimer = 0;
    setLocalPersistenceStatus(resolveLocalPersistenceStatus("start"));
    try {
      persist(notebookPersistencePayload);
      savedTimer = window.setTimeout(() => {
        if (!cancelled) setLocalPersistenceStatus(resolveLocalPersistenceStatus("success"));
      }, 120);
    } catch (error) {
      console.error("Draft persistence failed", error);
      setLocalPersistenceStatus(resolveLocalPersistenceStatus("failure"));
      setToast("本地草稿保存失败，请减少图片大小后重试");
    }
    return () => {
      cancelled = true;
      if (savedTimer) window.clearTimeout(savedTimer);
    };
  }, [notebookPersistencePayload]);

  useEffect(() => {
    try {
      localStorage.setItem(uiPreferencesStorageKey, JSON.stringify(state.uiPreferences));
    } catch (error) {
      console.error("UI preference persistence failed", error);
      setToast("界面偏好保存失败");
    }
  }, [state.uiPreferences]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.uiPreferences.theme;
    document.documentElement.dataset.density = state.uiPreferences.sidebarDensity;
    document.documentElement.dataset.transparency = state.uiPreferences.translucentMaterials ? "translucent" : "solid";
    document.documentElement.style.setProperty("--document-width", `${state.uiPreferences.contentWidthRatio}%`);
  }, [state.uiPreferences]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);


  const note = currentNote(state);
  const visibleNotes = useMemo(() => filteredNotes(state), [state]);
  const tagStats = useMemo(() => buildTagBrowser(state.notes).records, [state.notes]);
  const summary = useMemo(() => buildLibrarySummary(state.folders, state.notes), [state.folders, state.notes]);
  const tagBrowserModel = useMemo(() => {
    const browser = buildTagBrowser(state.notes, {
      query: state.tagQuery,
      sort: state.tagSort,
      selectedTag: state.selectedTag
    });
    return {
      ...browser,
      groups: groupTagRecords(browser.records),
      query: state.tagQuery,
      sort: state.tagSort,
      notesById: Object.fromEntries(state.notes.map((item) => [item.id, item]))
    };
  }, [state.notes, state.tagQuery, state.tagSort, state.selectedTag]);
  const visibleTreeItems = useMemo(() => buildVisibleTreeItems(state.folders, visibleNotes, state.collapsedFolders, { isSearching: Boolean(state.query.trim()) }), [state.folders, visibleNotes, state.collapsedFolders, state.query]);

  const areas = useMemo(() => buildKnowledgeAreas(state.folders, state.notes), [state.folders, state.notes]);

  const patchState = useCallback((recipe) => {
    setState((current) => {
      const next = structuredClone(current);
      recipe(next);
      return next;
    });
  }, []);
  const updateUiPreferences = useCallback((nextPreferences) => {
    patchState((draft) => {
      draft.uiPreferences = normalizeUiPreferences({ ...draft.uiPreferences, ...nextPreferences });
    });
  }, [patchState]);
  const updateGitHubSettings = useCallback((nextSettings) => {
    patchState((draft) => {
      draft.settings = {
        ...draft.settings,
        ...nextSettings,
        branch: "main"
      };
    });
  }, [patchState]);
  const deleteTag = (tag) => {
    const result = applyLocalTagMutation(state.notes, {
      mode: "delete",
      selectedTag: tag,
      timestamp: now()
    });
    if (!result.changed) {
      setToast("没有找到这个标签");
      return;
    }
    const deletedKey = normalizeTagName(tag).toLowerCase();
    patchState((draft) => {
      draft.notes = result.notes;
      draft.selectedTag = normalizeTagName(draft.selectedTag).toLowerCase() === deletedKey ? "" : draft.selectedTag;
      draft.uiPreferences = normalizeUiPreferences({ ...draft.uiPreferences, tagOrder: draft.uiPreferences.tagOrder.filter((item) => normalizeTagName(item).toLowerCase() !== deletedKey) });
      draft.deletedTags = uniqueTags([...(draft.deletedTags || []), tag]);
      draft.message = "标签已从所有文档中删除";
    });
    setToast("标签已删除并保存为本地草稿");
  };
  useEffect(() => {
    if (!state.openCreateMenu) return undefined;
    const closeCreateMenu = (event) => {
      if (event.target.closest?.(".create-menu, .mini-action, .sidebar-create-control, .document-overflow-menu, .document-overflow-trigger")) return;
      patchState((draft) => {
        draft.openCreateMenu = null;
      });
    };
    window.addEventListener("pointerdown", closeCreateMenu, true);
    return () => window.removeEventListener("pointerdown", closeCreateMenu, true);
  }, [state.openCreateMenu, patchState]);

  const hasEditSession = state.authenticated || state.mode === "edit";
  const requireEditPermission = (pendingAuthAction = "edit") => {
    if (state.authenticated || (pendingAuthAction === "edit" && state.mode === "edit")) return true;
    patchState((draft) => {
      draft.pendingAuthAction = pendingAuthAction;
      draft.modal = "auth";
      draft.openCreateMenu = null;
    });
    setToast("没有编辑权限，请先打开编辑权限");
    return false;
  };
  const selectNote = (noteId) => {
    patchState((draft) => {
      draft.activeId = noteId;
      draft.collapsedFolders = revealNoteFolderPath(draft.collapsedFolders, draft.folders, draft.notes, noteId);
      draft.mode = draft.uiPreferences.defaultMode;
      draft.view = "library";
      draft.modal = null;
      draft.openCreateMenu = null;
    });
    setIsContextSidebarOpen(false);
  };

  const treeDragDisabled = Boolean(state.query.trim());
  const targetForTreeEvent = (event, item) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
    if (["note", "folder"].includes(draggedTreeItem?.type) && item.type === "folder" && offset > .25 && offset < .75) {
      return { ...item, position: "inside" };
    }
    return { ...item, position: offset < .5 ? "before" : "after" };
  };
  const treeDrag = {
    disabled: treeDragDisabled,
    start: (event, item) => {
      if (treeDragDisabled) return;
      setDraggedTreeItem(item);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-notebook-tree-item", JSON.stringify(item));
      event.dataTransfer.setData("text/plain", item.id);
    },
    over: (event, item) => {
      if (treeDragDisabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragTarget(targetForTreeEvent(event, item));
    },
    leave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDragTarget(null);
    },
    end: () => {
      setDragTarget(null);
      setDraggedTreeItem(null);
    },
    drop: (event, item) => {
      event.preventDefault();
      setDragTarget(null);
      setDraggedTreeItem(null);
      if (treeDragDisabled || !requireEditPermission("edit")) return;
      try {
        const dragged = JSON.parse(event.dataTransfer.getData("application/x-notebook-tree-item"));
        const target = targetForTreeEvent(event, item);
        const result = applyTreeDrop(state, dragged, target);
        if (!result.changed) {
          if (result.reason === "descendant-folder") setToast("文件夹不能拖入自身的子目录");
          return;
        }
        patchState((draft) => {
          const next = applyTreeDrop({ folders: draft.folders, notes: draft.notes }, dragged, target);
          if (!next.changed) return;
          draft.folders = next.folders;
          draft.notes = next.notes;
          draft.openCreateMenu = null;
          if (target.type === "folder" && target.position === "inside") {
            delete draft.collapsedFolders?.[target.id];
          }
          draft.message = "目录位置已更新，发表后同步";
        });
        setToast("目录位置已更新，发表后同步");
      } catch {
        setToast("拖拽位置无效");
      }
    }
  };

  const enterTag = (tag) => {
    patchState((draft) => {
      Object.assign(draft, enterTagView(draft, tag, { clearQuery: true }));
    });
  };
  const selectTag = (tag) => {
    patchState((draft) => {
      Object.assign(draft, enterTagView(draft, tag));
    });
  };
  const openTagNote = (noteId) => {
    patchState((draft) => {
      draft.tagReturnContext = buildTagReturnContext(draft);
    });
    selectNote(noteId);
  };
  const navigate = (view) => {
    patchState((draft) => {
      Object.assign(draft, navigatePrimaryView(draft, view));
    });
    setIsContextSidebarOpen(false);
  };
  const openArea = (folderId) => {
    patchState((draft) => {
      const folderIds = new Set([folderId]);
      let foundChild = true;
      while (foundChild) {
        foundChild = false;
        draft.folders.forEach((folder) => {
          if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
            folderIds.add(folder.id);
            foundChild = true;
          }
        });
      }
      draft.view = "library";
      draft.selectedTag = "";
      draft.query = "";
      draft.activeId = draft.notes.find((item) => folderIds.has(item.folderId))?.id || draft.activeId;
      draft.mode = draft.uiPreferences.defaultMode;
      draft.modal = null;
      draft.modalContext = null;
      draft.openCreateMenu = null;
      if (draft.collapsedFolders) delete draft.collapsedFolders[folderId];
    });
  };

  const updateNote = (noteId, updater) => {
    if (!hasEditSession) {
      requireEditPermission("edit");
      return;
    }
    patchState((draft) => {
      const item = draft.notes.find((candidate) => candidate.id === noteId);
      if (!item) return;
      updater(item, draft);
      item.date = now();
      item.dirty = true;
      draft.message = "草稿已保存本地";
    });
  };

  const createFolder = () => {
    if (!requireEditPermission("edit")) return;
    const name = document.querySelector("[data-modal-input='folderName']")?.value.trim() || "新文件夹";
    patchState((draft) => {
      const parentId = draft.modalContext?.folderId || null;
      draft.folders.push({ id: `folder-${Date.now()}`, name, parentId });
      if (parentId) delete draft.collapsedFolders?.[parentId];
      draft.modal = null;
      draft.modalContext = null;
    });
    setToast("文件夹已创建");
  };

  const createNote = (targetFolderId) => {
    if (!requireEditPermission("edit")) return;
    const title = document.querySelector("[data-modal-input='noteTitle']")?.value.trim() || "未命名文档";
    patchState((draft) => {
      const id = `note-${Date.now()}`;
      const folderId = targetFolderId ?? draft.modalContext?.folderId ?? null;
      draft.notes.unshift({
        id,
        title,
        folderId,
        tags: [],
        date: now(),
        file: `notebooks/docs/${slugify(title)}.json`,
        dirty: true,
        publishedAt: "",
        assets: [],
        html: "<p></p>"
      });
      if (folderId) delete draft.collapsedFolders?.[folderId];
      draft.activeId = id;
      draft.mode = draft.uiPreferences.defaultMode;
      draft.view = "library";
      draft.selectedTag = "";
      draft.query = "";
      draft.openCreateMenu = null;
      draft.modal = null;
      draft.modalContext = null;
      draft.message = "新文档已保存为本地草稿";
    });
    setToast("文档已创建");
  };

  const renameFolder = () => {
    if (!requireEditPermission("edit")) return;
    const name = document.querySelector("[data-modal-input='renameFolder']")?.value.trim() || "未命名文件夹";
    patchState((draft) => {
      const folder = draft.folders.find((item) => item.id === draft.modalContext?.folderId);
      if (folder) folder.name = name;
      draft.modal = null;
      draft.modalContext = null;
    });
    setToast("文件夹已重命名");
  };

  const renameNote = () => {
    if (!requireEditPermission("edit")) return;
    const title = document.querySelector("[data-modal-input='renameNote']")?.value.trim() || "未命名文档";
    const noteId = state.modalContext?.noteId;
    if (!noteId) return;
    updateNote(noteId, (item) => {
      item.title = title;
      item.file = item.file || `notebooks/docs/${slugify(title)}.json`;
    });
    patchState((draft) => {
      draft.modal = null;
      draft.modalContext = null;
    });
    setToast("文档已重命名");
  };

  const deleteNote = (noteId = state.activeId) => {
    if (!requireEditPermission("edit")) return;
    if (state.notes.length <= 1) {
      setToast("至少保留一篇笔记");
      return;
    }
    patchState((draft) => {
      draft.notes = draft.notes.filter((item) => item.id !== noteId);
      draft.activeId = draft.activeId === noteId ? draft.notes[0]?.id || "" : draft.activeId;
      draft.mode = "read";
      draft.openCreateMenu = null;
      draft.message = "删除已保存到本地，发表任意文档后目录会更新";
    });
    setToast("文档已移入本地草稿变更");
  };

  const deleteFolder = (folderId) => {
    if (!requireEditPermission("edit")) return;
    const folderIds = new Set([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      state.folders.forEach((folder) => {
        if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
          folderIds.add(folder.id);
          changed = true;
        }
      });
    }
    const noteIds = new Set(state.notes.filter((item) => folderIds.has(item.folderId)).map((item) => item.id));
    if (noteIds.size >= state.notes.length) {
      setToast("至少保留一篇笔记");
      return;
    }
    patchState((draft) => {
      draft.folders = draft.folders.filter((folder) => !folderIds.has(folder.id));
      draft.notes = draft.notes.filter((item) => !noteIds.has(item.id));
      if (noteIds.has(draft.activeId)) draft.activeId = draft.notes[0]?.id || "";
      folderIds.forEach((id) => delete draft.collapsedFolders?.[id]);
      draft.openCreateMenu = null;
      draft.mode = "read";
      draft.message = "删除已保存到本地，发表任意文档后目录会更新";
    });
    setToast("文件夹已移入本地草稿变更");
  };

  const openDeleteDraftsModal = async () => {
    if (!note) return;
    patchState((draft) => {
      draft.message = "正在检查本地草稿和已发表版本";
      draft.openCreateMenu = null;
    });
    try {
      const published = await loadPublishedLibrary();
      if (!published?.notes?.length) {
        setToast("没有读取到已发表版本，暂时不能删除草稿");
        return;
      }
      const summary = buildDraftDeletionSummary(state, published);
      patchState((draft) => {
        draft.modal = "delete-drafts";
        draft.modalContext = { published, summary };
        draft.openCreateMenu = null;
        draft.message = "删除草稿前请确认将丢弃的本地内容";
      });
    } catch (error) {
      console.error(error);
      setToast(error.message || "读取已发表版本失败");
    }
  };

  const confirmDeleteDrafts = () => {
    const published = state.modalContext?.published;
    if (!published?.notes?.length) {
      setToast("没有可恢复的已发表版本");
      return;
    }
    localStorage.removeItem(blockNoteStorageKey);
    localStorage.removeItem(legacyStorageKey);
    setState((latest) => {
      const preferredActiveId = published.notes.some((item) => item.id === latest.activeId)
        ? latest.activeId
        : published.notes[0]?.id || "";
      return migrate({
        ...published,
        activeId: preferredActiveId,
        view: latest.view,
        selectedTag: latest.selectedTag,
        query: latest.query,
        settings: { ...latest.settings, token: latest.settings.token },
        uiPreferences: latest.uiPreferences,
        modal: null,
        modalContext: null,
        mode: "read",
        syncStatus: "ready",
        message: "本地草稿已删除，已恢复为最近一次发表版本"
      });
    });
    setToast("本地草稿已删除");
  };
  const confirmAuth = () => {
    const account = document.querySelector("[data-auth='account']")?.value.trim();
    const password = document.querySelector("[data-auth='password']")?.value.trim();
    if (!account || !password) {
      setToast("请输入账号和密码");
      return;
    }
    const authSettings = {
      ...state.settings,
      account,
      owner: state.settings.owner || account,
      repo: state.settings.repo || inferRepo(),
      branch: "main",
      token: password
    };
    const action = state.pendingAuthAction;
    patchState((draft) => {
      draft.settings = authSettings;
      draft.authenticated = true;
      draft.pendingAuthAction = "";
      draft.modal = null;
      if (action === "edit") draft.mode = "edit";
    });
    setToast("验证已通过");
    if (action === "publish") {
      preparePublish(authSettings);
    }
  };

  const openLocalTagModal = (mode, selectedTag = state.selectedTag) => {
    if (mode === "create" && !note) {
      setToast("先打开一篇笔记，再为它新建标签");
      return;
    }
    if (mode === "rename" && !selectedTag) return;
    if (!requireEditPermission("edit")) return;
    patchState((draft) => {
      draft.modal = "manage-tag";
      draft.modalContext = { mode, noteId: note?.id || "", selectedTag };
      draft.openCreateMenu = null;
    });
  };

  const confirmLocalTag = () => {
    const mode = state.modalContext?.mode;
    const name = document.querySelector("[data-local-tag-name]")?.value.trim() || "";
    const isNoteScopedRename = mode === "rename-note";
    const result = isNoteScopedRename
      ? applyNoteTagMutation(state.notes, {
          mode: "rename",
          noteId: state.modalContext?.noteId,
          selectedTag: state.modalContext?.selectedTag,
          name,
          timestamp: now()
        })
      : applyLocalTagMutation(state.notes, {
          mode,
          noteId: state.modalContext?.noteId,
          selectedTag: state.modalContext?.selectedTag,
          name,
          timestamp: now()
        });
    if (!result.changed) {
      if (result.error === "duplicate") {
        patchState((draft) => {
          draft.selectedTag = result.selectedTag;
          draft.view = "tags";
          draft.modal = null;
          draft.modalContext = null;
        });
        setToast("这个标签已经存在");
      } else {
        setToast(result.error === "no-note" ? "先打开一篇笔记，再为它新建标签" : "请输入标签名称");
      }
      return;
    }
    patchState((draft) => {
      draft.notes = result.notes;
      if (!isNoteScopedRename) {
        draft.selectedTag = result.selectedTag;
        draft.tagQuery = "";
        draft.view = "tags";
      }
      draft.modal = null;
      draft.modalContext = null;
      draft.message = "标签改动已保存为本地草稿";
    });
    setToast(mode === "rename" || mode === "rename-note" ? "标签已重命名并保存为本地草稿" : "标签已创建并保存为本地草稿");
  };

  const openPublishTagModal = () => {
    if (!note) return;
    patchState((draft) => {
      draft.modal = "publish-tags";
      draft.modalContext = { noteId: note.id };
      draft.openCreateMenu = null;
    });
  };

  const confirmPublishTags = () => {
    if (!note) return;
    const selected = [];
    document.querySelectorAll("[data-tag-row]").forEach((row) => {
      const original = row.getAttribute("data-tag-row") || "";
      if (row.querySelector("[data-tag-selected]")?.checked && original) selected.push(original);
    });
    const newTagInput = document.querySelector("[data-publish-tag-new]")?.value || "";
    const newTag = normalizeTagName(newTagInput);
    if (newTag) selected.push(newTag);
    const nextTags = ensureDefaultTags(uniqueTags(selected));
    const noteId = state.modalContext?.noteId || note.id;
    const updatedNotes = state.notes.map((item) => {
      const tags = item.id === noteId ? nextTags : ensureDefaultTags(item.tags);
      const changed = JSON.stringify(tags) !== JSON.stringify(ensureDefaultTags(item.tags));
      return changed ? { ...item, tags, date: now(), dirty: true } : item;
    });
    const localState = {
      ...state,
      notes: updatedNotes
    };
    patchState((draft) => {
      draft.notes = localState.notes;
      draft.modal = null;
      draft.modalContext = null;
      draft.openCreateMenu = null;
    });
    openPublishReview({ ...state.settings, branch: "main" }, localState);
  };

  const preparePublish = (overrideSettings, skipTagModal = false) => {
    if (!note) return;
    const settings = { ...(overrideSettings || state.settings), branch: "main" };
    if (!overrideSettings && !state.authenticated) {
      requireEditPermission("publish");
      return;
    }
    if (!settings.token || !settings.owner || !settings.repo) {
      patchState((draft) => {
        draft.pendingAuthAction = "publish";
        draft.modal = "auth";
      });
      setToast("请先完成验证");
      return;
    }
    if (!skipTagModal) {
      openPublishTagModal();
      return;
    }
    openPublishReview(settings, state);
  };

  const openPublishReview = async (settings, localState) => {
    patchState((draft) => {
      draft.modal = null;
      draft.modalContext = null;
      draft.message = "正在比较本地改动与 GitHub";
    });
    try {
      const remoteState = await loadGitHubPublishedLibrary(settings);
      const changeSet = buildPublishChangeSet(localState, remoteState);
      patchState((draft) => {
        draft.modal = "publish-review";
        draft.modalContext = {
          settings,
          review: {
            localState,
            remoteState,
            changes: changeSet.changes,
            selectedIds: changeSet.selectedIds
          }
        };
        draft.openCreateMenu = null;
        draft.syncStatus = "ready";
        draft.message = changeSet.changes.length ? "已检测到待发表改动" : "没有检测到待发表改动";
      });
    } catch (error) {
      console.error(error);
      patchState((draft) => {
        draft.syncStatus = "error";
        draft.message = error.message || "读取 GitHub 已发表内容失败";
      });
      setToast(error.message || "读取 GitHub 已发表内容失败，请检查 token 和仓库权限");
    }
  };

  const publishSelectedChanges = async (settings, review, selectedIds) => {
    if (!selectedIds.size) {
      setToast("请至少选择一项改动");
      return;
    }
    const validation = validatePublishSelection(review.changes, selectedIds);
    if (!validation.valid) { setToast("删除标签时，请同时选择受影响的文档"); return; }
    patchState((draft) => {
      draft.syncStatus = "publishing";
      draft.message = "正在发表选中的改动到 GitHub";
      draft.modal = "publish-review";
      draft.modalContext.review.selectedIds = Array.from(selectedIds);
    });
    try {
      const publishedAt = now();
      const latestRemoteState = await loadGitHubPublishedLibrary(settings);
      const merged = mergeSelectedPublishState(review.localState, latestRemoteState, selectedIds);
      const selectedNotes = assignSelectedPublishFiles(merged.selectedNotes, latestRemoteState.notes || []);
      const selectedById = new Map(selectedNotes.map((item) => [item.id, item]));
      const publishState = {
        ...merged.state,
        notes: merged.state.notes.map((item) => selectedById.get(item.id) || item)
      };
      const publishedNotes = [];
      for (const item of selectedNotes) {
        const publishTags = ensureDefaultTags(item.tags);
        const publishedAssets = await publishPendingAssets(settings, item);
        const publishedHtml = replaceLocalAssetUrls(
          normalizeHtml(item.html || blocksToHtml(item.blocks)),
          publishedAssets
        );
        const publishedNote = {
          ...item,
          dirty: false,
          publishedAt,
          date: publishedAt,
          html: publishedHtml,
          assets: sanitizePublishedAssets(publishedAssets, publishedHtml),
          tags: publishTags
        };
        const documentData = {
          version: 1,
          id: item.id,
          title: item.title,
          folderId: item.folderId,
          path: folderPath(publishState, item.folderId),
          tags: publishTags,
          createdAt: item.createdAt || item.date || publishedAt,
          updatedAt: publishedAt,
          assets: publishedNote.assets,
          html: publishedHtml
        };
        await putGitHubFile(settings, publishedNote.file, documentData, `Publish notebook: ${item.title}`);
        publishedNotes.push(publishedNote);
      }
      const publishedById = new Map(publishedNotes.map((item) => [item.id, item]));
      const indexState = {
        ...publishState,
        notes: publishState.notes.map((item) => publishedById.get(item.id) || item)
      };
      for (const remoteNote of merged.deletedRemoteNotes) {
        await deleteGitHubFile(settings, remoteNote.file, `Delete notebook: ${remoteNote.title}`);
      }
      await putGitHubFile(settings, publishedIndexPath, buildPublishedIndex(indexState, publishedAt), "Publish selected notebook changes");
      setState((latest) => {
        const next = structuredClone(latest);
        next.notes = reconcilePublishedNotes(latest.notes, publishedNotes, selectedIds);
        if (merged.includeDeletedTags) next.deletedTags = [];
        next.syncStatus = "ready";
        next.message = `已发表 ${selectedIds.size} 项改动到 GitHub 仓库`;
        next.modal = null;
        next.modalContext = null;
        return next;
      });
      setToast("已发表到 GitHub");
    } catch (error) {
      console.error(error);
      patchState((draft) => {
        draft.syncStatus = "error";
        draft.message = error.message || "发表失败";
      });
      setToast(error.message || "发表失败，请检查 token 和仓库权限");
    }
  };
  const handleAction = (action, targetFolderId) => {
    if (action === "search-library") {
      patchState((draft) => {
        draft.query = targetFolderId;
      });
    }
    if (action === "clear-selected-tag") {
      patchState((draft) => {
        draft.selectedTag = "";
      });
    }
    if (action === "back-to-tag") {
      patchState((draft) => {
        Object.assign(draft, restoreTagView(draft));
      });
    }
    if (action === "toggle-mode") {
      if (state.mode !== "edit" && !hasEditSession) {
        requireEditPermission("edit");
        return;
      }
      patchState((draft) => {
        draft.mode = draft.mode === "edit" ? "read" : "edit";
        draft.openCreateMenu = null;
      });
    }
    if (action === "close-document-actions") {
      patchState((draft) => {
        draft.openCreateMenu = null;
      });
    }
    if (action === "toggle-document-actions") {
      patchState((draft) => {
        draft.openCreateMenu = draft.openCreateMenu === "document-actions" ? null : "document-actions";
      });
    }
    if (action === "publish") preparePublish();
    if (action === "delete-drafts") openDeleteDraftsModal();
    if (action === "toggle-create-menu") {
      if (!requireEditPermission("edit")) return;
      patchState((draft) => {
        draft.openCreateMenu = draft.openCreateMenu === targetFolderId ? null : targetFolderId;
      });
    }
    if (action === "toggle-folder") {
      patchState((draft) => {
        draft.collapsedFolders = draft.collapsedFolders || {};
        if (draft.collapsedFolders[targetFolderId]) {
          delete draft.collapsedFolders[targetFolderId];
        } else {
          draft.collapsedFolders[targetFolderId] = true;
          if (draft.openCreateMenu === targetFolderId) draft.openCreateMenu = null;
        }
      });
    }
    if (action === "new-folder-in-folder") {
      if (!requireEditPermission("edit")) return;
      patchState((draft) => {
        draft.modalContext = { folderId: targetFolderId };
        draft.openCreateMenu = null;
        draft.modal = "name-folder";
      });
    }
    if (action === "new-note-in-folder") {
      createNote(targetFolderId);
    }
    if (action === "close-modal") {
      patchState((draft) => {
        draft.modal = null;
        draft.modalContext = null;
        draft.openCreateMenu = null;
      });
    }
    if (action === "confirm-folder") createFolder();
    if (action === "confirm-note") createNote();
    if (action === "confirm-rename-folder") renameFolder();
    if (action === "confirm-rename-note") renameNote();
    if (action === "confirm-auth") confirmAuth();
    if (action === "confirm-publish-tags") confirmPublishTags();
    if (action === "confirm-local-tag") confirmLocalTag();
    if (action === "create-note-tag") {
      if (state.mode !== "edit") {
        setToast("请先进入编辑模式再新建标签");
        return;
      }
      openLocalTagModal("create");
    }
    if (action === "toggle-publish-selection") {
      patchState((draft) => {
        const review = draft.modalContext?.review;
        if (!review) return;
        review.selectedIds = review.selectedIds.length === review.changes.length
          ? []
          : review.changes.map((change) => change.id);
      });
    }
    if (action === "update-publish-selection-count") {
      const selectedIds = Array.from(
        document.querySelectorAll("[data-publish-change-id]:checked"),
        (input) => input.dataset.publishChangeId
      );
      patchState((draft) => {
        if (draft.modalContext?.review) draft.modalContext.review.selectedIds = selectedIds;
      });
    }
    if (action === "confirm-publish-selected") {
      const selectedIds = new Set(state.modalContext?.review?.selectedIds || []);
      publishSelectedChanges(state.modalContext?.settings, state.modalContext?.review, selectedIds);
    }
    if (action === "confirm-delete-drafts") confirmDeleteDrafts();
    if (action === "delete-note") deleteNote(targetFolderId || state.activeId);
    if (action === "delete-folder") deleteFolder(targetFolderId);
    if (action === "rename-note-tag") {
      if (state.mode !== "edit") {
        setToast("请先进入编辑模式再修改标签");
        return;
      }
      if (!targetFolderId || !note || !requireEditPermission("edit")) return;
      patchState((draft) => {
        draft.modalContext = { mode: "rename-note", noteId: note.id, selectedTag: targetFolderId };
        draft.openCreateMenu = null;
        draft.modal = "manage-tag";
      });
    }
    if (action === "delete-note-tag") {
      if (state.mode !== "edit") {
        setToast("请先进入编辑模式再删除标签");
        return;
      }
      if (!targetFolderId || !note || !requireEditPermission("edit")) return;
      const result = applyNoteTagMutation(state.notes, {
        mode: "delete",
        noteId: note?.id,
        selectedTag: targetFolderId,
        timestamp: now()
      });
      if (!result.changed) {
        setToast("没有找到这个标签");
        return;
      }
      patchState((draft) => {
        draft.notes = result.notes;
        draft.message = "标签已从当前文档中删除";
      });
      setToast("标签已从当前文档删除");
    }
    if (action === "rename-folder") {
      if (!requireEditPermission("edit")) return;
      patchState((draft) => {
        draft.modalContext = { folderId: targetFolderId };
        draft.openCreateMenu = null;
        draft.modal = "rename-folder";
      });
    }
    if (action === "rename-note") {
      if (!requireEditPermission("edit")) return;
      patchState((draft) => {
        draft.modalContext = { noteId: targetFolderId };
        draft.openCreateMenu = null;
        draft.modal = "rename-note";
      });
    }
  };

  const defaultTreeFocusId = visibleTreeItems.some((item) => item.id === treeFocusId)
    ? treeFocusId
    : visibleTreeItems.some((item) => item.id === state.activeId)
      ? state.activeId
      : visibleTreeItems[0]?.id || "";
  const focusTreeItem = (id) => {
    setTreeFocusId(id);
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll("[data-tree-id]")).find((element) => element.dataset.treeId === id);
      target?.focus();
    });
  };
  const treeKeyboard = {
    focusedId: defaultTreeFocusId,
    onFocus: setTreeFocusId,
    onKeyDown: (event) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const currentId = event.currentTarget.dataset.treeId;
      const action = resolveTreeKeyboard(visibleTreeItems, currentId, event.key);
      event.preventDefault();
      event.stopPropagation();
      if (action.toggleFolderId) handleAction("toggle-folder", action.toggleFolderId);
      if (action.focusId) focusTreeItem(action.focusId);
    }
  };

  const renderActiveView = () => {
    if (state.view === "tags") {
      return h(TagBrowser, {
        model: tagBrowserModel,
        onQuery: (query) => patchState((draft) => { draft.tagQuery = query; }),
        onSort: (sort) => patchState((draft) => { draft.tagSort = sort; }),
        onSelectTag: selectTag,
        onOpenNote: openTagNote,
        canCreateTag: Boolean(note),
        onCreateTag: () => openLocalTagModal("create"),
        onRenameTag: (tag) => openLocalTagModal("rename", tag)
      });
    }
    if (state.view === "settings") {
      return h(SettingsPage, {
        category: state.settingsCategory,
        preferences: state.uiPreferences,
        github: state.settings,
        tags: tagCatalog(state),
        onChangePreferences: updateUiPreferences,
        onReorderTags: (tagOrder) => updateUiPreferences({ tagOrder }),
        onDeleteTag: deleteTag,
        onChangeGitHubSettings: updateGitHubSettings
      });
    }
    if (state.view !== "library") {
      return h("section", { className: "empty library-placeholder" },
        h("div", null, h("h2", null, "知识库设置"), h("p", null, "此视图将在下一阶段接入。"))
      );
    }
    return h(React.Fragment, null,
      renderDocumentTopbar(state, note, state.uiPreferences, localPersistenceStatus, handleAction),
      h(PaperScroll, null,
        note
          ? h(DocumentPaper, {
              key: `${note.id}-${state.mode}`,
              note,
              state,
              editable: state.mode === "edit",
              updateNote,
              handleAction
            })
          : h("div", { className: "empty" },
              h("div", null, h("h2", null, "选择一篇笔记"), h("p", null, "选择左侧文档开始阅读")))
      )
    );
  };

  return h(React.Fragment, null,
    h("div", { className: "app-shell", "data-view": state.view },
      h(PrimaryRail, { view: state.view, onNavigate: navigate }),
      state.view === "settings"
        ? h("div", {
            id: "context-sidebar",
            className: `context-sidebar settings-sidebar-shell ${isContextSidebarOpen ? "is-open" : ""}`,
            role: "navigation",
            "aria-label": "设置目录"
          }, h(SettingsSidebar, {
              activeCategory: state.settingsCategory,
              onSelectCategory: (settingsCategory) => {
                patchState((draft) => { draft.settingsCategory = settingsCategory; });
                setIsContextSidebarOpen(false);
              }
            }))
        : state.view === "library"
          ? renderContextSidebar(state, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard, isContextSidebarOpen)
          : null,
      h("main", { className: "content" },
        state.view === "library"
          ? h("button", {
              type: "button",
              className: "context-sidebar-toggle",
              "aria-controls": "context-sidebar",
              "aria-expanded": isContextSidebarOpen,
              "aria-label": isContextSidebarOpen ? "关闭目录" : "打开目录",
              onClick: () => setIsContextSidebarOpen(toggleContextDrawer)
            }, icon("library", { size: 17 }), h("span", null, "目录"))
          : null,
        state.view === "home"
          ? h(LibraryHome, {
              summary,
              areas,
              tags: tagStats,
              onCreateNote: () => createNote(),
              onOpenArea: openArea,
              onOpenTag: enterTag
            })
          : renderActiveView()
      )
    ),
    renderModal(state, handleAction),
    toast ? h("div", { className: "toast" }, toast) : null
  );
}

function PaperScroll({ children }) {
  const scrollRef = useRef(null);
  const dragRef = useRef(null);
  const [metrics, setMetrics] = useState({
    clientWidth: 1,
    clientHeight: 1,
    scrollWidth: 1,
    scrollHeight: 1,
    scrollLeft: 0,
    scrollTop: 0
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const update = () => {
      setMetrics({
        clientWidth: Math.max(1, element.clientWidth),
        clientHeight: Math.max(1, element.clientHeight),
        scrollWidth: Math.max(1, element.scrollWidth),
        scrollHeight: Math.max(1, element.scrollHeight),
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop
      });
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [children]);

  const vertical = customScrollbarGeometry(metrics.scrollTop, metrics.clientHeight, metrics.scrollHeight);
  const horizontal = customScrollbarGeometry(metrics.scrollLeft, metrics.clientWidth, metrics.scrollWidth);

  const beginDrag = (axis) => (event) => {
    const element = scrollRef.current;
    if (!element) return;
    const track = event.currentTarget.parentElement;
    const trackSize = axis === "y" ? track.clientHeight : track.clientWidth;
    const thumbSize = axis === "y" ? event.currentTarget.offsetHeight : event.currentTarget.offsetWidth;
    dragRef.current = {
      axis,
      pointerId: event.pointerId,
      startPointer: axis === "y" ? event.clientY : event.clientX,
      startScroll: axis === "y" ? element.scrollTop : element.scrollLeft,
      maxScroll: axis === "y" ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth,
      travel: Math.max(1, trackSize - thumbSize)
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handleDrag = (event) => {
    const drag = dragRef.current;
    const element = scrollRef.current;
    if (!drag || !element || drag.pointerId !== event.pointerId) return;
    const pointer = drag.axis === "y" ? event.clientY : event.clientX;
    const next = drag.startScroll + ((pointer - drag.startPointer) / drag.travel) * drag.maxScroll;
    if (drag.axis === "y") element.scrollTop = next;
    else element.scrollLeft = next;
    event.preventDefault();
  };

  const endDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return h("div", { className: "paper-scroll-shell" },
    h("section", { className: "paper-scroll", ref: scrollRef }, children),
    vertical.visible ? h("div", { className: "paper-scrollbar paper-scrollbar-y", "aria-hidden": "true" },
      h("span", {
        className: "paper-scrollbar-thumb",
        style: { top: `${vertical.offset}%`, height: `${vertical.size}%` },
        onPointerDown: beginDrag("y"),
        onPointerMove: handleDrag,
        onPointerUp: endDrag,
        onPointerCancel: endDrag
      })
    ) : null,
    horizontal.visible ? h("div", { className: "paper-scrollbar paper-scrollbar-x", "aria-hidden": "true" },
      h("span", {
        className: "paper-scrollbar-thumb",
        style: { left: `${horizontal.offset}%`, width: `${horizontal.size}%` },
        onPointerDown: beginDrag("x"),
        onPointerMove: handleDrag,
        onPointerUp: endDrag,
        onPointerCancel: endDrag
      })
    ) : null
  );
}

function customScrollbarGeometry(scrollOffset, clientSize, scrollSize) {
  const visible = scrollSize > clientSize + 1;
  if (!visible) return { visible: false, size: 100, offset: 0 };
  const size = Math.max(18, Math.min(100, (clientSize / scrollSize) * 100));
  const maxOffset = 100 - size;
  const offset = Math.max(0, Math.min(maxOffset, (scrollOffset / Math.max(1, scrollSize - clientSize)) * maxOffset));
  return { visible, size, offset };
}
function renderNoteTagPill(tag, note, handleAction, editable) {
  return h("span", { className: "pill note-tag-pill", key: tag },
    h("span", { className: "note-tag-label" }, tag),
    editable ? h("span", { className: "note-tag-actions", "aria-hidden": "false" },
      h("button", {
        type: "button",
        className: "note-tag-action note-tag-rename",
        title: `重命名标签 ${tag}`,
        "aria-label": `重命名标签 ${tag}`,
        onClick: () => handleAction("rename-note-tag", tag),
        onPointerDown: (event) => event.stopPropagation()
      }, icon("edit", { size: 12, strokeWidth: 2 })),
      h("button", {
        type: "button",
        className: "note-tag-action note-tag-delete",
        title: `删除标签 ${tag}`,
        "aria-label": `删除标签 ${tag}`,
        onClick: () => handleAction("delete-note-tag", tag),
        onPointerDown: (event) => event.stopPropagation()
      }, icon("trash", { size: 12, strokeWidth: 2 }))
    ) : null
  );
}

function DocumentPaper({ note, state, editable, updateNote, handleAction }) {
  const html = normalizeHtml(note.html || blocksToHtml(note.blocks));
  const outline = useMemo(() => documentOutlineFromHtml(html), [html]);
  const readerRef = useRef(null);
  const closePreviewTimerRef = useRef(0);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (!editable && readerRef.current) {
      enhanceReaderCodeBlocks(readerRef.current);
      renderMathElements(readerRef.current);
    }
  }, [editable, html]);

  useEffect(() => () => {
    if (closePreviewTimerRef.current) window.clearTimeout(closePreviewTimerRef.current);
  }, []);

  const closeImagePreview = useCallback(() => {
    setImagePreview((preview) => preview ? { ...preview, closing: true } : preview);
    if (closePreviewTimerRef.current) window.clearTimeout(closePreviewTimerRef.current);
    closePreviewTimerRef.current = window.setTimeout(() => {
      closePreviewTimerRef.current = 0;
      setImagePreview(null);
    }, 180);
  }, []);

  useEffect(() => {
    if (!imagePreview) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeImagePreview();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [imagePreview, closeImagePreview]);

  const openImagePreview = useCallback((event) => {
    const image = event.target?.closest?.("img");
    if (!image) return false;
    event.preventDefault();
    event.stopPropagation();
    if (closePreviewTimerRef.current) {
      window.clearTimeout(closePreviewTimerRef.current);
      closePreviewTimerRef.current = 0;
    }
    const rect = image.getBoundingClientRect();
    const maxWidth = Math.max(320, window.innerWidth * .9);
    const maxHeight = Math.max(240, window.innerHeight * .86);
    const widthScale = rect.width > 0 ? rect.width / Math.min(maxWidth, Math.max(rect.width, 1)) : .86;
    const heightScale = rect.height > 0 ? rect.height / Math.min(maxHeight, Math.max(rect.height, 1)) : .86;
    const originScale = Math.max(.12, Math.min(.92, widthScale, heightScale));
    setImagePreview({
      src: image.currentSrc || image.src,
      alt: image.alt || "文档图片预览",
      originX: Number.isFinite(rect.left) ? rect.left + rect.width / 2 : window.innerWidth / 2,
      originY: Number.isFinite(rect.top) ? rect.top + rect.height / 2 : window.innerHeight / 2,
      originScale,
      closing: false
    });
    return true;
  }, []);

  const showOutline = state.uiPreferences.showOutline;
  return h("div", { className: `document-workspace ${showOutline ? (outline.length ? "has-outline" : "has-empty-outline") : "without-outline"}` },
    h("article", { className: `paper ${editable ? "is-editing" : ""}`, "data-note-id": note.id },
      editable
        ? h("input", {
            className: "doc-title-input",
            value: note.title,
            placeholder: "无标题",
            onChange: (event) => updateNote(note.id, (item) => {
              item.title = event.target.value;
            })
          })
        : h("h1", { className: "doc-title" }, note.title),
      h("div", { className: "doc-meta" },
        h("span", { className: "pill" }, folderPath(state, note.folderId) || "未归档"),
        ensureDefaultTags(note.tags).map((tag) => renderNoteTagPill(tag, note, handleAction, editable)),
        editable ? h("button", {
          type: "button",
          className: "pill note-tag-create",
          onClick: () => handleAction("create-note-tag"),
          "aria-label": "新建标签"
        }, icon("add", { size: 14, strokeWidth: 2 }), "新建标签") : null,
        h("span", { className: `pill ${note.dirty ? "dirty" : ""}` }, note.dirty ? "本地草稿" : "已发表"),
        h("span", { className: "pill" }, formatDate(note.date))
      ),
      h("div", { className: "tiptap-shell" },
        editable
          ? h(TiptapEditor, {
              key: note.id,
              note,
              onChange: (nextHtml) => updateNote(note.id, (item) => {
                item.html = normalizeDraftHtml(nextHtml, item.html, item.assets);
              }),
              onAssetInserted: (asset, nextHtml) => updateNote(note.id, (item) => {
                const assets = Array.isArray(item.assets) ? item.assets : [];
                item.assets = [...assets.filter((candidate) => candidate.id !== asset.id), asset];
                item.html = normalizeHtml(nextHtml);
              }),
              onImagePreview: openImagePreview
            })
          : h("div", {
              ref: readerRef,
              className: "reader tiptap-reader",
              onClick: openImagePreview,
              dangerouslySetInnerHTML: { __html: sanitizeHtml(html) }
            })
      )
    ),
    imagePreview ? h(DocumentImagePreview, { preview: imagePreview, onClose: closeImagePreview }) : null,
    state.uiPreferences.showOutline ? h(DocumentOutline, { noteId: note.id, outline }) : null
  );
}

function DocumentImagePreview({ preview, onClose }) {
  return h("div", {
    className: `image-preview-backdrop ${preview.closing ? "is-closing" : ""}`,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "图片预览",
    onClick: onClose
  },
    h("button", {
      type: "button",
      className: "image-preview-close",
      "aria-label": "关闭图片预览",
      title: "关闭",
      onClick: onClose
    }, h(X, { size: 20, strokeWidth: 2 })),
    h("figure", {
      className: "image-preview-frame",
      style: {
        "--preview-origin-x": `${preview.originX}px`,
        "--preview-origin-y": `${preview.originY}px`,
        "--preview-origin-scale": preview.originScale
      },
      onClick: (event) => event.stopPropagation()
    },
      h("img", { src: preview.src, alt: preview.alt, draggable: "false" })
    )
  );
}

function DocumentOutline({ noteId, outline }) {
  const activeButtonRef = useRef(null);
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(outline[0]?.index ?? -1);

  useEffect(() => {
    setActiveHeadingIndex(outline[0]?.index ?? -1);
  }, [noteId, outline]);

  useEffect(() => {
    if (!outline.length) return undefined;
    const selector = `[data-note-id="${cssEscape(noteId)}"]`;
    const paper = document.querySelector(selector);
    const scrollRoot = paper?.closest(".paper-scroll");
    if (!paper || !scrollRoot) return undefined;

    const updateActiveHeading = () => {
      const headings = documentHeadingsForPaper(paper);
      if (!headings.length) return;
      const viewport = scrollRoot.getBoundingClientRect();
      const centerY = viewport.top + viewport.height / 2;
      let activeIndex = 0;

      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= centerY) activeIndex = index;
      });
      setActiveHeadingIndex(activeIndex);
    };

    updateActiveHeading();
    scrollRoot.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    return () => {
      scrollRoot.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [noteId, outline]);

  useEffect(() => {
    const activeButton = activeButtonRef.current;
    if (!activeButton) return;
    scrollElementIntoNearestView(activeButton);
  }, [activeHeadingIndex]);

  return h("nav", {
    className: "document-outline",
    "aria-label": "\u6587\u6863\u76ee\u5f55"
  },
    h("div", { className: "document-outline-title" }, "\u5927\u7eb2"),
    outline.length
      ? h("ol", null, outline.map((item) => h("li", {
          key: item.key,
          className: `document-outline-item level-${item.level} ${item.index === activeHeadingIndex ? "is-active" : ""}`.trim()
        },
          h("button", {
            ref: item.index === activeHeadingIndex ? activeButtonRef : null,
            type: "button",
            title: item.text,
            "aria-current": item.index === activeHeadingIndex ? "location" : undefined,
            onClick: () => scrollToDocumentHeading(noteId, item.index)
          }, h("span", { className: "document-outline-text" }, item.text))
        )))
      : h("p", { className: "document-outline-empty" }, "\u6682\u65e0\u6807\u9898")
  );
}
function documentOutlineFromHtml(html) {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.querySelectorAll("h1, h2, h3"))
    .map((node, index) => ({
      key: `${index}-${node.tagName}`,
      index,
      level: Number(node.tagName.slice(1)),
      text: (node.textContent || "").replace(/\s+/g, " ").trim()
    }))
    .filter((item) => item.text);
}

function scrollToDocumentHeading(noteId, headingIndex) {
  const selector = `[data-note-id="${cssEscape(noteId)}"]`;
  const paper = document.querySelector(selector);
  const headings = paper ? documentHeadingsForPaper(paper) : [];
  const heading = headings[headingIndex];
  if (!heading) return;
  const scrollRoot = paper.closest(".paper-scroll");
  if (!scrollRoot) return;
  const viewport = scrollRoot.getBoundingClientRect();
  const target = heading.getBoundingClientRect();
  scrollRoot.scrollTo({
    top: scrollRoot.scrollTop + target.top - viewport.top - 16,
    behavior: "smooth"
  });
}

function documentHeadingsForPaper(paper) {
  return paper.querySelectorAll(".tiptap-reader h1, .tiptap-reader h2, .tiptap-reader h3, .feishu-editor h1, .feishu-editor h2, .feishu-editor h3");
}

function scrollElementIntoNearestView(element) {
  const scroller = element.closest("ol");
  if (!scroller) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  if (elementRect.left < scrollerRect.left) {
    scroller.scrollLeft -= scrollerRect.left - elementRect.left;
  } else if (elementRect.right > scrollerRect.right) {
    scroller.scrollLeft += elementRect.right - scrollerRect.right;
  }

  if (elementRect.top < scrollerRect.top) {
    scroller.scrollTop -= scrollerRect.top - elementRect.top;
  } else if (elementRect.bottom > scrollerRect.bottom) {
    scroller.scrollTop += elementRect.bottom - scrollerRect.bottom;
  }
}
function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function TiptapEditor({ note, onChange, onAssetInserted, onImagePreview }) {
  const shellRef = useRef(null);
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const sideButtonFrameRef = useRef(0);
  const sideButtonUpdateSeqRef = useRef(0);
  const pendingAssetKindRef = useRef("file");
  const [editor, setEditor] = useState(null);
  const [insertMenu, setInsertMenu] = useState(null);
  const [tablePicker, setTablePicker] = useState(null);
  const [sideButton, setSideButton] = useState({ top: 72 });
  const [isSelectingText, setIsSelectingText] = useState(false);

  const insertPastedAssets = useCallback(async (files) => {
    if (!files.length || !editorRef.current) return;
    try {
      let html = editorRef.current.getHTML();
      for (const file of files) {
        const asset = await cacheNotebookAsset(note, file, normalizeAssetKind("", file.type, file.name));
        insertAssetNode(editorRef.current, asset);
        html = editorRef.current.getHTML();
        onAssetInserted?.(asset, html);
      }
      onChange(editorRef.current.getHTML());
    } catch (error) {
      window.alert(error.message || "Paste attachment failed");
    }
  }, [note, onAssetInserted, onChange]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const updateSideButton = (current) => {
      sideButtonUpdateSeqRef.current += 1;
      const updateSeq = sideButtonUpdateSeqRef.current;
      if (sideButtonFrameRef.current) window.cancelAnimationFrame(sideButtonFrameRef.current);
      sideButtonFrameRef.current = window.requestAnimationFrame(() => {
        sideButtonFrameRef.current = 0;
        if (updateSeq !== sideButtonUpdateSeqRef.current || !current?.view || !shellRef.current) return;
        try {
          const coords = current.view.coordsAtPos(current.state.selection.from);
          const shellRect = shellRef.current.getBoundingClientRect();
          const nextTop = Math.max(4, coords.top - shellRect.top - 2);
          if (!Number.isFinite(nextTop)) return;
          setSideButton((previous) => Math.abs(previous.top - nextTop) < 1 ? previous : { top: nextTop });
        } catch {
          // Keep the previous position when ProseMirror cannot resolve coords during blank-area clicks.
        }
      });
    };
    const instance = new Editor({
      element: hostRef.current,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
        NotebookCodeBlock,
        MathInline,
        MathBlock,
        MermaidDiagram,
        Placeholder.configure({
          placeholder: "输入 / 插入内容",
          showOnlyCurrent: false
        }),
        Underline,
        Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noreferrer" } }),
        TextStyle,
        Color.configure({ types: ["textStyle"] }),
        Highlight.configure({ multicolor: true }),
        Image,
        Video,
        FileAttachment,
        Table.configure({ resizable: true, cellMinWidth: 96, lastColumnResizable: false }),
        TableRow,
        StyledTableHeader,
        StyledTableCell,
        TaskList,
        TaskItem.configure({ nested: true })
      ],
      content: normalizeHtml(note.html || blocksToHtml(note.blocks)),
      editorProps: {
        transformPastedHTML(html) {
          return sanitizeHtml(restoreMarkdownMathInHtml(html));
        },
        attributes: { class: "feishu-editor ProseMirror" },
        handleClick(view, position, event) {
          if (event.target?.closest?.("img")) return Boolean(onImagePreview?.(event));
          return false;
        },
        handleDOMEvents: {
          mousedown(view, event) {
            if (event.button !== 0) return false;
            setIsSelectingText(true);
            setInsertMenu(null);
            return false;
          },
          mouseup(view) {
            window.requestAnimationFrame(() => {
              setIsSelectingText(false);
              updateSideButton(editorRef.current || view.editor);
            });
            return false;
          },
          paste(view, event) {
            const files = clipboardFilesFromPaste(event);
            if (files.length) {
              event.preventDefault();
              setInsertMenu(null);
              insertPastedAssets(files);
              return true;
            }
            const html = event.clipboardData?.getData("text/html") || "";
            if (html.trim()) return false;
            const text = event.clipboardData?.getData("text/plain") || "";
            if (!markdownTextLooksStructured(text)) return false;
            event.preventDefault();
            setInsertMenu(null);
            editorRef.current?.chain().focus().insertContent(markdownTextToHtmlWithMath(text)).run();
            if (editorRef.current) onChange(editorRef.current.getHTML());
            return true;
          },
          click(view, event) {
            return maybeCreateParagraphAtClick(view, event);
          },
          dblclick(view, event) {
            return maybeCreateParagraphBetweenBlocks(view, event);
          }
        },
        handleKeyDown(view, event) {
          if (maybeReplaceGapCursorWithParagraph(editorRef.current, event)) return true;
          const tableLineKind = tableSelectionKind(editorRef.current);
          if ((event.key === "Backspace" || event.key === "Delete") && tableLineKind) {
            event.preventDefault();
            applyTableCommand(editorRef.current, tableLineKind === "row" ? "delete-row" : "delete-column");
            return true;
          }
          if (event.key === "Tab" && editorRef.current?.isActive("table")) {
            event.preventDefault();
            const command = event.shiftKey ? "goToPreviousCell" : "goToNextCell";
            const moved = editorRef.current.chain().focus()[command]().run();
            if (!moved && !event.shiftKey) {
              editorRef.current.chain().focus().addRowAfter().goToNextCell().run();
            }
            return true;
          }
          if (event.key === "/" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
            window.setTimeout(() => {
              const rect = getEditorSelectionRect(view);
              const from = view.state.selection.from;
              const slashRange = view.state.doc.textBetween(Math.max(0, from - 1), from) === "/"
                ? { from: from - 1, to: from }
                : null;
              if (rect && shellRef.current) setInsertMenu({
                ...menuPositionInShell(rect, shellRef.current, "selection"),
                slashRange
              });
            }, 0);
          }
          if (event.key === "Escape") setInsertMenu(null);
          return false;
        }
      },
      onUpdate({ editor: current }) {
        updateSideButton(current);
        onChange(current.getHTML());
      },
      onSelectionUpdate({ editor: current }) {
        setInsertMenu(null);
        updateSideButton(current);
      },
      onFocus({ editor: current }) {
        updateSideButton(current);
      }
    });
    editorRef.current = instance;
    setEditor(instance);
    updateSideButton(instance);
    return () => {
      if (sideButtonFrameRef.current) window.cancelAnimationFrame(sideButtonFrameRef.current);
      instance.destroy();
      editorRef.current = null;
      setEditor(null);
    };
  }, [note.id]);

  useEffect(() => {
    const stopSelecting = () => {
      window.requestAnimationFrame(() => setIsSelectingText(false));
    };
    window.addEventListener("mouseup", stopSelecting);
    window.addEventListener("blur", stopSelecting);
    return () => {
      window.removeEventListener("mouseup", stopSelecting);
      window.removeEventListener("blur", stopSelecting);
    };
  }, []);

  useEffect(() => {
    if (!insertMenu && !tablePicker) return undefined;
    const closeInsertPanels = (event) => {
      if (event.target?.closest?.(".feishu-insert-menu, .table-insert-grid, .feishu-plus")) return;
      setInsertMenu(null);
      setTablePicker(null);
    };
    window.addEventListener("pointerdown", closeInsertPanels, true);
    return () => window.removeEventListener("pointerdown", closeInsertPanels, true);
  }, [insertMenu, tablePicker]);

  const run = async (command, context = {}) => {
    if (!editorRef.current) return;
    if (insertMenu?.slashRange) {
      const { from, to } = insertMenu.slashRange;
      if (editorRef.current.state.doc.textBetween(from, to) === "/") {
        editorRef.current.chain().focus().deleteRange({ from, to }).run();
      }
    }
    if (command === "table") {
      setTablePicker(tablePickerPositionForTrigger(context.event, shellRef.current, insertMenu || { left: 52, top: sideButton.top + 28 }));
      return;
    }
    await applyEditorCommand(editorRef.current, command, {
      note,
      fileInputRef,
      pendingAssetKindRef
    });
    setInsertMenu(null);
    onChange(editorRef.current.getHTML());
  };

  const handleFileInput = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editorRef.current) return;
    try {
      const asset = await cacheNotebookAsset(note, file, pendingAssetKindRef.current);
      insertAssetNode(editorRef.current, asset);
      onAssetInserted?.(asset, editorRef.current.getHTML());
    } catch (error) {
      window.alert(error.message || "附件插入失败");
    }
  };

  return h("div", { className: "feishu-editor-shell", ref: shellRef },
    editor ? h(FeishuBubbleToolbar, { editor, shellRef, hidden: Boolean(insertMenu) || isSelectingText }) : null,
    editor ? h(FeishuTableControls, { editor, shellRef }) : null,
    h("button", {
      className: "feishu-plus",
      style: { top: `${sideButton.top}px` },
      title: "插入内容",
      onMouseDown: (event) => event.preventDefault(),
      onClick: (event) => {
        editorRef.current?.chain().focus().run();
        const rect = event.currentTarget.getBoundingClientRect();
        if (shellRef.current) setInsertMenu(menuPositionInShell(rect, shellRef.current, "plus"));
      }
    }, "+"),
    h("div", { ref: hostRef }),
    h("input", {
      ref: fileInputRef,
      type: "file",
      className: "hidden-file-input",
      onChange: handleFileInput
    }),
    insertMenu ? h(FeishuInsertMenu, { position: insertMenu, run }) : null,
    tablePicker ? h(TableInsertGrid, {
      position: tablePicker,
      onSelect: (rows, cols) => {
        editorRef.current?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        setTablePicker(null);
        setInsertMenu(null);
        if (editorRef.current) onChange(editorRef.current.getHTML());
      },
    }) : null
  );
}

function FeishuBubbleToolbar({ editor, shellRef, hidden }) {
  const [position, setPosition] = useState(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  const updatePosition = useCallback(() => {
    if (hidden || !editor || editor.state.selection.empty || !shellRef.current) {
      setPosition(null);
      setColorPanelOpen(false);
      setStyleMenuOpen(false);
      return;
    }
    const rect = getSelectionToolbarRect(editor.view?.dom);
    setPosition(rect ? getBubbleToolbarPosition(rect, shellRef.current) : null);
  }, [editor, hidden, shellRef]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [updatePosition, selectionVersion]);

  useEffect(() => {
    if (!editor) return undefined;
    const updateSelection = () => {
      setColorPanelOpen(false);
      setStyleMenuOpen(false);
      setSelectionVersion((value) => value + 1);
    };
    const updateActiveState = () => forceUpdate((value) => value + 1);
    editor.on("selectionUpdate", updateSelection);
    editor.on("transaction", updateActiveState);
    return () => {
      editor.off("selectionUpdate", updateSelection);
      editor.off("transaction", updateActiveState);
    };
  }, [editor]);

  if (hidden || !editor || editor.state.selection.empty || tableSelectionInfo(editor) || !position) return null;
  const iconNode = (Icon, size = 17) => h(Icon, { size, strokeWidth: 1.9, "aria-hidden": "true" });
  const activeBlockStyle = (() => {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("orderedList")) return "orderedList";
    if (editor.isActive("bulletList")) return "bulletList";
    return "paragraph";
  })();
  const styleItems = [
    { icon: Type, label: "\u6b63\u6587", command: "paragraph", active: activeBlockStyle === "paragraph" },
    { icon: Heading1, label: "\u6807\u9898 1", command: "h1", active: activeBlockStyle === "h1" },
    { icon: Heading2, label: "\u6807\u9898 2", command: "h2", active: activeBlockStyle === "h2" },
    { icon: Heading3, label: "\u6807\u9898 3", command: "h3", active: activeBlockStyle === "h3" },
    { icon: ListOrdered, label: "\u6709\u5e8f\u5217\u8868", command: "orderedList", active: activeBlockStyle === "orderedList" },
    { icon: List, label: "\u65e0\u5e8f\u5217\u8868", command: "bulletList", active: activeBlockStyle === "bulletList" }
  ];
  const buttons = [
    { icon: Bold, command: "bold", title: "\u52a0\u7c97", active: editor.isActive("bold") },
    { icon: Strikethrough, command: "strike", title: "\u5220\u9664\u7ebf", active: editor.isActive("strike") },
    { icon: Italic, command: "italic", title: "\u659c\u4f53", active: editor.isActive("italic") },
    { icon: UnderlineIcon, command: "underline", title: "\u4e0b\u5212\u7ebf", active: editor.isActive("underline") },
    { icon: LinkIcon, command: "link", title: "\u94fe\u63a5", active: editor.isActive("link") },
    { icon: Code2, command: "code", title: "\u4ee3\u7801", active: editor.isActive("code") },
    { label: "A", command: "textColor", title: "\u6587\u5b57\u989c\u8272", active: colorPanelOpen || Boolean(editor.getAttributes("textStyle").color), panel: true, className: "feishu-color-trigger" },
    { divider: true },
    { icon: TableIcon, command: "table", title: "\u8868\u683c" },
    { icon: Quote, command: "blockquote", title: "\u5f15\u7528", active: editor.isActive("blockquote") }
  ];
  const textColors = ["#245bdb", "#1f2329", "#f54a45", "#f59f00", "#de7b00", "#2f9e44", "#2563eb", "#7c3aed"];
  const backgroundColors = ["transparent", "#f2f3f5", "#ffe8e8", "#ffe8c2", "#fff4b8", "#d9f7d8", "#dbe7ff", "#e8dcff", "#e4e7eb", "#c9cdd4", "#ff6b5f", "#ff9f43", "#ffd43b", "#51cf66", "#91a7ff", "#b197fc"];
  const runBubbleCommand = (command) => {
    applyEditorCommand(editor, command);
    setColorPanelOpen(false);
    setStyleMenuOpen(false);
  };
  const renderStylePanel = () => h("div", {
    className: "feishu-style-panel",
    onMouseDown: (event) => event.preventDefault()
  }, styleItems.map((item) => h("button", {
    key: item.command,
    className: item.active ? "active" : "",
    onClick: () => runBubbleCommand(item.command)
  },
    h("span", { className: "feishu-style-icon" }, iconNode(item.icon, 18)),
    h("span", null, item.label),
    item.active ? iconNode(Check, 16) : h("span", { "aria-hidden": "true" })
  )));
  const renderColorPanel = () => h("div", {
    className: "feishu-color-panel",
    onMouseDown: (event) => event.preventDefault()
  },
    h("div", { className: "feishu-color-section" },
      h("div", { className: "feishu-color-title" }, "\u5b57\u4f53\u989c\u8272"),
      h("div", { className: "feishu-color-row" }, textColors.map((color) => h("button", {
        key: "text-" + color,
        className: "feishu-text-color-swatch",
        style: { color },
        title: color,
        onClick: () => {
          applyEditorCommand(editor, "text-color-" + color);
          setColorPanelOpen(false);
        }
      }, "A")))
    ),
    h("div", { className: "feishu-color-section" },
      h("div", { className: "feishu-color-title" }, "\u80cc\u666f\u989c\u8272"),
      h("div", { className: "feishu-color-grid" }, backgroundColors.map((color) => h("button", {
        key: "background-" + color,
        className: "feishu-bg-color-swatch " + (color === "transparent" ? "empty" : ""),
        style: { background: color === "transparent" ? "#ffffff" : color },
        title: color === "transparent" ? "\u65e0\u80cc\u666f" : color,
        onClick: () => {
          applyEditorCommand(editor, color === "transparent" ? "highlight-reset" : "highlight-" + color);
          setColorPanelOpen(false);
        }
      })))
    ),
    h("button", {
      className: "feishu-color-reset",
      onClick: () => {
        applyEditorCommand(editor, "text-color-reset");
        applyEditorCommand(editor, "highlight-reset");
        setColorPanelOpen(false);
      }
    }, "\u6062\u590d\u9ed8\u8ba4")
  );
  return h("div", {
    className: "feishu-bubble " + (position.placement === "below" ? "below" : "above"),
    style: {
      left: position.left + "px",
      top: position.top + "px"
    },
    onMouseDown: (event) => event.preventDefault()
  }, buttons.map((button, index) => button.divider
    ? h("span", { className: "feishu-bubble-divider", key: "divider-" + index })
    : index === 0
      ? [
          h("button", {
            key: "style-trigger",
            className: "feishu-bubble-button feishu-style-trigger",
            title: "\u6587\u672c\u6837\u5f0f",
            onClick: () => {
              setColorPanelOpen(false);
              setStyleMenuOpen((open) => !open);
            }
          }, iconNode(Type, 18), iconNode(ChevronDown, 14)),
          h("span", { className: "feishu-bubble-divider", key: "style-divider" }),
          h("button", {
            key: button.command + "-" + index,
            className: ["feishu-bubble-button", button.active ? "active" : "", button.className || ""].filter(Boolean).join(" "),
            title: button.title || button.command,
            onClick: () => runBubbleCommand(button.command)
          }, button.icon ? iconNode(button.icon) : button.label)
        ]
      : h("button", {
          key: button.command + "-" + index,
          className: ["feishu-bubble-button", button.active ? "active" : "", button.className || ""].filter(Boolean).join(" "),
          title: button.title || button.command,
          onClick: () => button.panel
            ? (setStyleMenuOpen(false), setColorPanelOpen((open) => !open))
            : runBubbleCommand(button.command)
        }, button.icon ? iconNode(button.icon) : button.label)),
    styleMenuOpen ? renderStylePanel() : null,
    colorPanelOpen ? renderColorPanel() : null);
}

function FeishuInsertMenu({ position, run }) {
  const iconNode = (Icon, size = 17) => h(Icon, { size, strokeWidth: 1.9, "aria-hidden": "true" });
  const sections = [
    {
      title: "文本",
      items: [
        { icon: Heading1, label: "标题 1", command: "h1" },
        { icon: Heading2, label: "标题 2", command: "h2" },
        { icon: Heading3, label: "标题 3", command: "h3" },
        { icon: ListOrdered, label: "有序列表", command: "orderedList" },
        { icon: List, label: "无序列表", command: "bulletList" },
        { icon: Braces, label: "代码块", command: "codeBlock" },
        { icon: Quote, label: "引用", command: "blockquote" },
        { icon: Minus, label: "分割线", command: "divider" },
        { icon: LinkIcon, label: "链接", command: "link" }
      ]
    },
    {
      title: "插入",
      items: [
        { icon: ImageIcon, label: "图片", command: "image", color: "#ffb800" },
        { icon: VideoIcon, label: "视频", command: "video", color: "#15b8a6" },
        { icon: FileUp, label: "文件附件", command: "file", color: "#64748b" },
        { icon: TableIcon, label: "表格", command: "table", color: "#00b578", arrow: true },
        { icon: GitBranch, label: "Mermaid 流程图", command: "mermaidDiagram", color: "#3370ff" },
        { icon: Sigma, label: "\u516c\u5f0f", command: "mathBlock", color: "#6b7280" }
      ]
    }
  ];
  return h("div", {
    className: "feishu-insert-menu",
    style: { left: `${position.left}px`, top: `${position.top}px` },
    onMouseDown: (event) => event.preventDefault()
  }, sections.map((section) => h("div", { className: "feishu-menu-section", key: section.title },
    h("div", { className: "feishu-menu-title" }, section.title),
    section.items.map((item) => h("button", { key: `${section.title}-${item.label}`, onClick: (event) => run(item.command, { event, item }) },
      h("span", { className: "feishu-menu-icon", style: { color: item.color || "#1f2329" } }, typeof item.icon === "string" ? item.icon : iconNode(item.icon)),
      h("span", null, item.label),
      item.arrow ? h("i", null, "›") : null
    ))
  )));
}

async function applyEditorCommand(editor, command, context = {}) {
  const chain = editor.chain().focus();
  if (command === "paragraph") chain.setParagraph().run();
  if (command === "h1") chain.toggleHeading({ level: 1 }).run();
  if (command === "h2") chain.toggleHeading({ level: 2 }).run();
  if (command === "h3") chain.toggleHeading({ level: 3 }).run();
  if (command === "bold") chain.toggleBold().run();
  if (command === "italic") chain.toggleItalic().run();
  if (command === "strike") chain.toggleStrike().run();
  if (command === "underline") chain.toggleUnderline().run();
  if (command === "code") chain.toggleCode().run();
  if (command === "highlight") chain.toggleHighlight({ color: "#fff36d" }).run();
  if (command === "text-color-reset") return chain.unsetColor().run();
  if (command === "highlight-reset") return chain.unsetHighlight().run();
  if (command.startsWith("text-color-")) return chain.setColor(command.slice(11)).run();
  if (command.startsWith("highlight-")) return chain.setHighlight({ color: command.slice(10) }).run();
  if (command === "bulletList") chain.toggleBulletList().run();
  if (command === "orderedList") chain.toggleOrderedList().run();
  if (command === "taskList") chain.toggleTaskList().run();
  if (command === "blockquote") chain.toggleBlockquote().run();
  if (command === "codeBlock") chain.toggleCodeBlock().run();
  if (command === "mathBlock") {
    insertFormula(editor);
    return;
  }
  if (command === "mermaidDiagram") {
    insertMermaidDiagram(editor);
    return;
  }
  if (command === "divider") chain.setHorizontalRule().run();
  if (command === "table") chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  if (command === "link") {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("链接地址", previous);
    if (url === null) return;
    if (!url) chain.unsetLink().run();
    else chain.extendMarkRange("link").setLink({ href: url }).run();
  }
  if (command === "image") {
    openAssetPicker(context, "image");
    return;
  }
  if (command === "video") {
    openAssetPicker(context, "video");
    return;
  }
  if (command === "file") {
    openAssetPicker(context, "file");
    return;
  }
  if (["columns", "highlightBlock", "button", "template"].includes(command)) {
    chain.insertContent(`<p>${commandName(command)}</p>`).run();
  }
}

function insertFormula(editor) {
  const { from, to, empty } = editor.state.selection;
  const selectedText = empty ? "" : editor.state.doc.textBetween(from, to).trim();
  const tex = window.prompt("\u516c\u5f0f", selectedText || "V_{in} = [x, y, z, r, x - v_x, y - v_y, z - v_z]");
  if (tex === null) return;
  const value = tex.trim();
  if (!value) return;
  const node = empty
    ? { type: mathBlockType, attrs: { tex: value } }
    : { type: mathInlineType, attrs: { tex: value } };
  if (empty) {
    insertBlockWithEditableParagraph(editor, node);
    return;
  }
  editor.chain().focus().deleteSelection().insertContent(node).run();
}

function insertMermaidDiagram(editor) {
  insertBlockWithEditableParagraph(editor, {
    type: mermaidDiagramType,
    attrs: { code: mermaidExample, error: "" }
  });
}

function commandName(command) {
  const names = {
    file: "文件附件",
    video: "视频",
    table: "表格",
    columns: "分栏",
    highlightBlock: "高亮块",
    button: "按钮",
    template: "模板"
  };
  return names[command] || command;
}

function markdownTextHasMath(text) {
  return /(^|[^\\])\${1,2}[\s\S]+?\${1,2}/.test(String(text || ""));
}

function markdownTextLooksStructured(text) {
  const source = String(text || "").trim();
  if (!source) return false;
  if (markdownTextHasMath(source)) return true;
  return /(^|\n)\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s+|```)/.test(source)
    || /\*\*[^*\n]+?\*\*/.test(source)
    || /`[^`\n]+?`/.test(source);
}

function markdownTextToHtmlWithMath(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push("<p>" + inlineMarkdownToHtmlWithMath(paragraph.join(" ").trim()) + "</p>");
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (trimmed.startsWith("```")) {
      flushParagraph();
      const codeLines = [];
      while (index + 1 < lines.length) {
        index += 1;
        if (lines[index].trim().startsWith("```")) break;
        codeLines.push(lines[index]);
      }
      blocks.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
      continue;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      blocks.push("<h" + level + ">" + inlineMarkdownToHtmlWithMath(heading[2].trim()) + "</h" + level + ">");
      continue;
    }
    if (trimmed.startsWith("$$")) {
      flushParagraph();
      const mathLines = [trimmed.replace(/^\$\$\s*/, "")];
      while (!mathLines.at(-1).trim().endsWith("$$") && index + 1 < lines.length) {
        index += 1;
        mathLines.push(lines[index]);
      }
      const tex = mathLines.join("\n").replace(/\s*\$\$$/, "").trim();
      blocks.push(mathHtml(tex, true));
      continue;
    }
    if (markdownListLine(line)) {
      flushParagraph();
      const parsed = parseMarkdownList(lines, index);
      blocks.push(parsed.html);
      index = parsed.nextIndex - 1;
      continue;
    }
    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      const quoteLines = [quote[1]];
      while (index + 1 < lines.length) {
        const nextQuote = lines[index + 1].trim().match(/^>\s+(.+)$/);
        if (!nextQuote) break;
        quoteLines.push(nextQuote[1]);
        index += 1;
      }
      blocks.push("<blockquote><p>" + inlineMarkdownToHtmlWithMath(quoteLines.join(" ")) + "</p></blockquote>");
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks.join("") || "<p></p>";
}

function markdownListLine(line) {
  return String(line || "").match(/^(\s*)(?:([-*+])|(\d+)[.)])\s+(.+)$/);
}

function parseMarkdownList(lines, startIndex, baseIndent = null) {
  const first = markdownListLine(lines[startIndex]);
  const indent = baseIndent ?? first[1].replace(/\t/g, "    ").length;
  const ordered = Boolean(first[3]);
  const tag = ordered ? "ol" : "ul";
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = markdownListLine(lines[index]);
    if (!match) break;
    const currentIndent = match[1].replace(/\t/g, "    ").length;
    const currentOrdered = Boolean(match[3]);
    if (currentIndent < indent || currentOrdered !== ordered) break;
    if (currentIndent > indent) {
      if (!items.length) break;
      const nested = parseMarkdownList(lines, index, currentIndent);
      items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, nested.html + "</li>");
      index = nested.nextIndex;
      continue;
    }
    items.push("<li>" + inlineMarkdownToHtmlWithMath(match[4].trim()) + "</li>");
    index += 1;
    while (index < lines.length && lines[index].trim() && !markdownListLine(lines[index])) {
      items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, " " + inlineMarkdownToHtmlWithMath(lines[index].trim()) + "</li>");
      index += 1;
    }
  }

  return { html: "<" + tag + ">" + items.join("") + "</" + tag + ">", nextIndex: index };
}
function inlineMarkdownToHtmlWithMath(text) {
  const source = String(text || "");
  let cursor = 0;
  let html = "";
  const inlineMath = /(^|[^\\])\$([^$\n]+?)\$/g;
  let match;
  while ((match = inlineMath.exec(source))) {
    const markerIndex = match.index + match[1].length;
    html += inlineMarkdownTextToHtml(source.slice(cursor, markerIndex));
    html += mathHtml(match[2].trim(), false);
    cursor = markerIndex + match[2].length + 2;
  }
  html += inlineMarkdownTextToHtml(source.slice(cursor));
  return html;
}

function inlineMarkdownTextToHtml(text) {
  return escapeHtml(text)
    .replace(/`+([^`\n]+?)`+/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\\\$/g, "$");
}
function mathHtml(tex, displayMode) {
  const tag = displayMode ? "div" : "span";
  const type = displayMode ? "math-block" : "math-inline";
  const escaped = escapeHtml(tex);
  return "<" + tag + " data-type=\"" + type + "\" class=\"math-node " + type + "\" data-tex=\"" + escaped + "\">" + escaped + "</" + tag + ">";
}

function renderMathElements(root) {
  root.querySelectorAll("[data-type='math-inline'], [data-type='math-block']").forEach((element) => {
    renderMathElement(element, element.dataset.type === "math-block");
  });
}

function renderMathElement(element, displayMode) {
  const tex = element.getAttribute("data-tex") || element.textContent || "";
  element.setAttribute("data-tex", tex);
  try {
    katex.render(tex, element, { displayMode, throwOnError: false, strict: "ignore" });
  } catch {
    element.textContent = displayMode ? "$$" + tex + "$$" : "$" + tex + "$";
  }
}

function restoreMarkdownMathInHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  template.content.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.querySelector("[data-type='math-inline'], [data-type='math-block'], code, pre")) return;
    const match = paragraph.textContent.trim().match(/^\$\$([\s\S]+?)\$\$$/);
    if (!match) return;
    const fragment = document.createRange().createContextualFragment(mathHtml(match[1].trim(), true));
    paragraph.replaceWith(fragment);
  });
  const walker = document.createTreeWalker(template.content, window.NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((textNode) => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest("pre, code, [data-type='math-inline'], [data-type='math-block']")) return;
    if (!markdownTextHasMath(textNode.nodeValue || "")) return;
    const fragment = document.createRange().createContextualFragment(inlineMarkdownToHtmlWithMath(textNode.nodeValue || ""));
    textNode.replaceWith(fragment);
  });
  return template.innerHTML;
}

function clipboardFilesFromPaste(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return [];
  const files = [];
  const seen = new Set();
  const addFile = (file) => {
    if (!file) return;
    const key = (file.name || "clipboard") + "-" + (file.type || "file") + "-" + file.size;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  Array.from(clipboard.items || []).forEach((item) => {
    if (item.kind !== "file") return;
    addFile(item.getAsFile());
  });
  Array.from(clipboard.files || []).forEach(addFile);
  return files;
}

function openAssetPicker({ fileInputRef, pendingAssetKindRef }, kind) {
  if (!fileInputRef?.current) return;
  pendingAssetKindRef.current = kind;
  fileInputRef.current.accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "";
  fileInputRef.current.click();
}

async function cacheNotebookAsset(note, file, requestedKind) {
  const kind = normalizeAssetKind(requestedKind, file.type, file.name);
  validateAssetFile(file, kind);
  const dataUrl = await readFileAsDataUrl(file);
  const content = dataUrlToBase64(dataUrl);
  const fileName = uniqueAssetFileName(file.name, file.type);
  const noteSegment = safeSegment(note.id || "note");
  const remotePath = `${assetRootPath}/${noteSegment}/${fileName}`;
  let localUrl = dataUrl;
  let cached = false;

  try {
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteId: note.id,
        name: fileName,
        type: file.type || "application/octet-stream",
        content
      })
    });
    if (response.ok) {
      const data = await response.json();
      localUrl = data.localUrl || `${localAssetPrefix}${noteSegment}/${fileName}`;
      cached = true;
    }
  } catch {
    cached = false;
  }

  return {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || fileName,
    fileName,
    kind,
    type: file.type || "application/octet-stream",
    size: file.size,
    localUrl,
    localPath: `.notebook-cache/assets/${noteSegment}/${fileName}`,
    remotePath,
    remoteUrl: remotePath,
    createdAt: Date.now(),
    cached,
    content: cached ? "" : content,
    dataUrl: cached ? "" : dataUrl,
    published: false
  };
}

function insertAssetNode(editor, asset) {
  if (asset.kind === "image") {
    insertBlockWithEditableParagraph(editor, {
      type: "image",
      attrs: { src: asset.localUrl, alt: asset.name, title: asset.name }
    });
    return;
  }
  if (asset.kind === "video") {
    insertBlockWithEditableParagraph(editor, {
      type: "video",
      attrs: { src: asset.localUrl, title: asset.name, controls: true }
    });
    return;
  }
  insertBlockWithEditableParagraph(editor, {
    type: "fileAttachment",
    attrs: {
      href: asset.localUrl,
      name: asset.name,
      size: formatBytes(asset.size)
    }
  });
}

function insertBlockWithEditableParagraph(editor, blockNode) {
  editor.chain().focus().deleteSelection().insertContent([
    blockNode,
    { type: "paragraph" }
  ]).run();
}

function maybeReplaceGapCursorWithParagraph(editor, event) {
  if (event.key !== "Enter" || !editor) return false;
  const selection = editor.state.selection;
  const isGapCursor = selection.constructor?.name === "GapCursor";
  const isAtomNodeSelection = Boolean(selection.node?.isAtom);
  if (!isGapCursor && !isAtomNodeSelection) return false;
  event.preventDefault();
  const position = selection.to;
  editor.chain().focus().insertContentAt(position, { type: "paragraph" }).setTextSelection(position + 1).run();
  return true;
}

function normalizeAssetKind(kind, mimeType, name = "") {
  if (kind === "image" || kind === "video") return kind;
  const type = String(mimeType || "").toLowerCase();
  const fileName = String(name || "").toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/.test(fileName)) return "image";
  if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi|mkv|ogv)$/.test(fileName)) return "video";
  return "file";
}

function validateAssetFile(file, kind) {
  const limits = {
    image: 10 * 1024 * 1024,
    video: 80 * 1024 * 1024,
    file: 50 * 1024 * 1024
  };
  const max = limits[kind] || limits.file;
  if (file.size > max) {
    throw new Error(`${kind === "image" ? "图片" : kind === "video" ? "视频" : "附件"}不能超过 ${formatBytes(max)}`);
  }
}

function safeSegment(value) {
  return slugify(String(value || "asset")).replace(/^-+|-+$/g, "") || "asset";
}

function uniqueAssetFileName(name, mimeType = "") {
  const cleaned = String(name || "attachment").replace(/[/\:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  const dot = cleaned.lastIndexOf(".");
  const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const inferredExt = extensionFromMimeType(mimeType);
  const ext = dot > 0 ? cleaned.slice(dot).toLowerCase() : inferredExt;
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${safeSegment(base).slice(0, 64) || "attachment"}-${stamp}-${suffix}${ext}`;
}

function extensionFromMimeType(mimeType) {
  const type = String(mimeType || "").toLowerCase();
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-m4v": ".m4v"
  };
  return map[type] || "";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getSelectionRect() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) return rect;
  const rects = range.getClientRects();
  return rects[0] || null;
}

function getSelectionToolbarRect(editorDom) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const editorRect = editorDom?.getBoundingClientRect?.() || null;
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.width || rect.height)
    .filter((rect) => !editorRect || (
      rect.bottom >= editorRect.top
      && rect.top <= editorRect.bottom
      && rect.right >= editorRect.left
      && rect.left <= editorRect.right
    ));

  if (!rects.length) return getSelectionRect();

  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function getBubbleToolbarPosition(rect, shell) {
  const shellRect = shell.getBoundingClientRect();
  const toolbarHeight = 50;
  const toolbarHalfWidth = Math.min(196, Math.max(18, shell.clientWidth / 2 - 18));
  const gap = 12;
  const rawLeft = rect.left + rect.width / 2 - shellRect.left;
  const left = Math.min(
    Math.max(toolbarHalfWidth, rawLeft),
    Math.max(toolbarHalfWidth, shell.clientWidth - toolbarHalfWidth)
  );
  const topAbove = rect.top - shellRect.top - toolbarHeight - gap;
  if (topAbove >= 8) {
    return { left, top: topAbove, placement: "above" };
  }
  return {
    left,
    top: Math.max(8, rect.bottom - shellRect.top + gap),
    placement: "below"
  };
}

function getEditorSelectionRect(view) {
  const rect = getSelectionRect();
  if (rect) return rect;
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return {
      left: coords.left,
      right: coords.right,
      top: coords.top,
      bottom: coords.bottom,
      width: Math.max(1, coords.right - coords.left),
      height: Math.max(1, coords.bottom - coords.top)
    };
  } catch {
    return null;
  }
}

function maybeCreateParagraphAtClick(view, event) {
  if (event.button !== 0 || event.defaultPrevented || !view?.dom) return false;
  if (!view.state.selection.empty) return false;

  const editorRect = view.dom.getBoundingClientRect();
  if (event.clientY < editorRect.top || event.clientY > editorRect.bottom) return false;

  const blocks = editorTopLevelBlocks(view);
  const lastBlock = blocks[blocks.length - 1];
  const lastRect = lastBlock?.getBoundingClientRect();
  const clickedBelowContent = !lastRect || event.clientY > lastRect.bottom + 6;
  const clickedEditorSurface = event.target === view.dom;

  if (clickedEditorSurface && !clickedBelowContent) {
    event.preventDefault();
    return true;
  }
  if (!clickedBelowContent) return false;

  return insertParagraphAtDocPosition(view, view.state.doc.content.size, event);
}

function maybeCreateParagraphBetweenBlocks(view, event) {
  if (event.button !== 0 || event.defaultPrevented || !view?.dom) return false;
  if (event.target !== view.dom) return false;

  const editorRect = view.dom.getBoundingClientRect();
  if (event.clientY < editorRect.top || event.clientY > editorRect.bottom) return false;

  const blocks = editorTopLevelBlocks(view);
  const gapIndex = blocks.findIndex((block, index) => {
    const next = blocks[index + 1];
    if (!next) return false;
    const currentRect = block.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    return event.clientY > currentRect.bottom + 2 && event.clientY < nextRect.top - 2;
  });
  if (gapIndex < 0) return false;

  const insertAt = topLevelDocPositionBefore(view, gapIndex + 1);
  return insertParagraphAtDocPosition(view, insertAt, event);
}

function editorTopLevelBlocks(view) {
  return Array.from(view.dom.children).filter((child) => child.nodeType === 1);
}

function topLevelDocPositionBefore(view, childIndex) {
  let position = 0;
  const maxIndex = Math.min(childIndex, view.state.doc.childCount);
  for (let index = 0; index < maxIndex; index += 1) {
    position += view.state.doc.child(index).nodeSize;
  }
  return position;
}

function insertParagraphAtDocPosition(view, insertAt, event) {
  const paragraph = view.state.schema.nodes.paragraph?.createAndFill();
  if (!paragraph) return false;

  event?.preventDefault?.();
  const safeInsertAt = Math.max(0, Math.min(insertAt, view.state.doc.content.size));
  const tr = view.state.tr.insert(safeInsertAt, paragraph);
  const selectionPos = Math.min(tr.doc.content.size, safeInsertAt + 1);
  const selection = view.state.selection.constructor.create(tr.doc, selectionPos);
  view.dispatch(tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}
function menuPositionInShell(rect, shell, anchor) {
  const shellRect = shell.getBoundingClientRect();
  const menuWidth = 268;
  const menuHeight = Math.min(644, Math.max(220, window.innerHeight - 88));
  const left = anchor === "plus"
    ? rect.right - shellRect.left + 8
    : rect.left - shellRect.left;
  const rawTop = anchor === "plus"
    ? rect.top - shellRect.top
    : rect.bottom - shellRect.top + 8;
  const overflow = Math.max(0, shellRect.top + rawTop + menuHeight - window.innerHeight + 12);
  const top = rawTop - overflow;
  return {
    left: Math.min(Math.max(0, left), Math.max(0, shell.clientWidth - menuWidth)),
    top: Math.max(0, top)
  };
}

function tablePickerPositionForTrigger(event, shell, menuPosition) {
  const shellRect = shell?.getBoundingClientRect?.();
  const triggerRect = event?.currentTarget?.getBoundingClientRect?.();
  const pickerWidth = 178;
  const gap = 8;
  if (!shell || !shellRect || !triggerRect) {
    return {
      left: Math.min(Math.max(0, (menuPosition?.left || 52) + 248 + gap), Math.max(0, (shell?.clientWidth || 480) - pickerWidth)),
      top: Math.max(0, menuPosition?.top || 0)
    };
  }
  return {
    left: Math.min(Math.max(0, triggerRect.right - shellRect.left + gap), Math.max(0, shell.clientWidth - pickerWidth)),
    top: Math.max(0, triggerRect.top - shellRect.top)
  };
}

function renderDocumentTopbar(state, note, preferences, localPersistenceStatus, handleAction) {
  return h("header", {
    className: "topbar document-topbar",
    "data-outline-visible": preferences.showOutline ? "true" : "false"
  },
    h("div", { className: "document-breadcrumb" },
      state.tagReturnContext ? h("button", {
        className: "tag-return-button",
        onClick: () => handleAction("back-to-tag"),
        "aria-label": `返回标签：${state.tagReturnContext.selectedTag}`
      }, icon("back", { size: 16 }), "返回标签") : null,
      h("span", null, state.selectedTag ? `# ${state.selectedTag}` : note ? folderPath(state, note.folderId) || "未归档" : "没有笔记"),
      note ? h("span", { className: "document-breadcrumb-separator", "aria-hidden": "true" }, "/") : null,
      h("strong", null, note ? note.title : "创建第一篇笔记")
    ),
    note ? h("span", {
      className: "document-save-status",
      role: "status",
      title: localPersistenceStatusText(localPersistenceStatus)
    }, localPersistenceStatusText(localPersistenceStatus)) : null,
    h("div", { className: "toolbar" },
      note ? h("div", { className: "document-action-group" },
        h("button", {
          className: `ghost-btn document-mode-toggle ${state.mode === "edit" ? "active" : ""}`,
          onClick: () => handleAction("toggle-mode"),
          "aria-pressed": state.mode === "edit"
        }, icon(state.mode === "read" ? "read" : "edit", { size: 16 }), state.mode === "read" ? "阅读" : "编辑"),
        h("span", { className: "document-action-divider", "aria-hidden": "true" }),
        h(DocumentOverflowMenu, { state, note, handleAction })
      ) : null,
      note ? h("button", {
        className: "primary-btn document-publish-button",
        "data-publish-trigger": "",
        disabled: state.syncStatus === "publishing",
        onClick: () => handleAction("publish")
      }, state.syncStatus === "publishing" ? "发表中" : [icon("upload", { size: 16 }), "发布"]) : null
    )
  );
}

function DocumentOverflowMenu({ state, note, handleAction }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const isOpen = state.openCreateMenu === "document-actions";

  useEffect(() => {
    if (!isOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector("[role=menuitem]:not(:disabled)")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const restoreTriggerFocus = () => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const closeMenu = () => {
    handleAction("close-document-actions");
    restoreTriggerFocus();
  };

  const runMenuAction = (action) => {
    handleAction("close-document-actions");
    handleAction(action, note.id);
    restoreTriggerFocus();
  };

  const handleMenuKeyDown = (event) => {
    const items = Array.from(menuRef.current?.querySelectorAll("[role=menuitem]:not(:disabled)") || []);
    const currentIndex = items.indexOf(document.activeElement);
    const result = resolveMenuKeyboard(currentIndex, event.key, items.length);
    if (result.close) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    items[result.focusIndex]?.focus();
  };

  return h("div", { className: "document-overflow", onKeyDown: handleMenuKeyDown },
    h("button", {
      ref: triggerRef,
      className: "ghost-btn document-overflow-trigger",
      type: "button",
      "aria-label": "更多文档操作",
      "aria-haspopup": "menu",
      "aria-expanded": isOpen,
      onClick: () => handleAction("toggle-document-actions")
    }, h(Ellipsis, { size: 18, strokeWidth: 1.8, "aria-hidden": "true" })),
    isOpen ? renderDocumentActionsMenu(state, menuRef, handleMenuKeyDown, runMenuAction) : null
  );
}

function renderDocumentActionsMenu(state, menuRef, handleMenuKeyDown, onAction) {
  return h("div", { ref: menuRef, className: "document-overflow-menu", role: "menu", "aria-label": "文档操作" },
    h("button", { type: "button", role: "menuitem", onClick: () => onAction("rename-note") }, "重命名"),
    h("button", { type: "button", role: "menuitem", onClick: () => onAction("delete-drafts") }, "删除本地草稿"),
    h("button", {
      type: "button",
      role: "menuitem",
      className: "danger-menu-item",
      disabled: state.syncStatus === "publishing",
      onClick: () => onAction("delete-note")
    }, "删除文档")
  );
}

function documentStatusText(state, note) {
  if (!note) return "选择或新建一篇文档开始记录。";
  if (state.syncStatus === "publishing") return "正在发表到 GitHub，请稍候。";
  if (note.dirty || !note.publishedAt) return "当前内容已临时保存在本地，点击「发表」后会推送到 GitHub。";
  const path = note.file || `notebooks/docs/${slugify(note.title || note.id)}.json`;
  return `已发表，GitHub 保存地址：${githubBrowserUrl(state.settings, path)}`;
}

function githubBrowserUrl(settings, path) {
  const owner = settings?.owner || inferOwner();
  const repo = settings?.repo || inferRepo();
  const branch = settings?.branch || "main";
  if (!owner || !repo || !path) return path || "notebooks/index.json";
  return `https://github.com/${owner}/${repo}/blob/${branch}/${trimSlash(path)}`;
}
function renderContextSidebar(state, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard, isContextSidebarOpen) {
  return h("nav", {
    id: "context-sidebar",
    className: `sidebar context-sidebar ${isContextSidebarOpen ? "is-open" : ""}`,
    "aria-label": "知识库目录"
  },
    h("header", { className: "sidebar-heading" },
      h("div", null,
        h("strong", null, "我的知识库"),
        h("span", null, "个人笔记")
      ),
      h("div", { className: "sidebar-create-control" },
        h("button", {
          className: "sidebar-add-note",
          "aria-label": "新建",
          title: "新建",
          onClick: () => handleAction("toggle-create-menu", "root")
        }, icon("add")),
        state.openCreateMenu === "root"
          ? h("div", { className: "create-menu" },
              h("button", { onClick: () => handleAction("new-note-in-folder", null) }, "新建文档"),
              h("button", { onClick: () => handleAction("new-folder-in-folder", null) }, "新建文件夹")
            )
          : null
      )
    ),
    h("label", { className: "search-wrap" },
      icon("search", { size: 16 }),
      h("span", { className: "sr-only" }, "搜索笔记"),
      h("input", {
        className: "search",
        value: state.query,
        placeholder: "搜索笔记、标签、内容",
        onChange: (event) => handleAction("search-library", event.target.value)
      })
    ),
    h("div", { className: "tree", role: "tree", "aria-label": "文档目录" },
      renderTree(state, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard)
    )
  );
}
function renderTree(state, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard) {
  const rootFolders = state.folders.filter((folder) => !folder.parentId);
  const orphanNotes = visibleNotes.filter((note) => !note.folderId);
  const children = [
    ...rootFolders.map((folder) => renderFolder(state, folder, 0, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard)),
    ...orphanNotes.map((note) => renderNoteItem(state, note, 0, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard))
  ];
  if (!visibleNotes.length) {
    children.push(h("div", { className: "empty", key: "empty" }, h("div", null, h("strong", null, "没有找到笔记"), h("p", null, "换个关键词试试。"))));
  }
  return children;
}

function renderFolder(state, folder, depth, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard) {
  const children = state.folders.filter((item) => item.parentId === folder.id);
  const notes = visibleNotes.filter((note) => note.folderId === folder.id);
  const count = countNotes(state, folder.id, visibleNotes);
  const isSearching = Boolean(state.query.trim());
  const isCollapsed = !isSearching && Boolean(state.collapsedFolders?.[folder.id]);
  if (state.query.trim() && count === 0) return null;
  return h("div", { className: "tree-section", key: folder.id },
    h("button", {
      className: `tree-folder indent-${Math.min(depth, 3)} ${isCollapsed ? "collapsed" : ""} ${dragTarget?.type === "folder" && dragTarget.id === folder.id ? `drop-${dragTarget.position}` : ""}`,
      title: isCollapsed ? "展开目录" : "收起目录",
      "data-tree-id": folder.id,
      tabIndex: treeKeyboard.focusedId === folder.id ? 0 : -1,
      onFocus: () => treeKeyboard.onFocus(folder.id),
      onKeyDown: (event) => treeKeyboard.onKeyDown(event),
      draggable: !treeDrag.disabled,
      onDragStart: (event) => treeDrag.start(event, { type: "folder", id: folder.id }),
      onDragOver: (event) => treeDrag.over(event, { type: "folder", id: folder.id }),
      onDragLeave: treeDrag.leave,
      onDragEnd: treeDrag.end,
      onDrop: (event) => treeDrag.drop(event, { type: "folder", id: folder.id }),
      onClick: () => handleAction("toggle-folder", folder.id),
      role: "treeitem",
      "aria-level": depth + 1,
      "aria-expanded": !isCollapsed,
      onDoubleClick: () => handleAction("rename-folder", folder.id)
    },
      h("span", {
        className: "folder-toggle",
        onClick: (event) => {
          event.stopPropagation();
          handleAction("toggle-folder", folder.id);
        }
      }, icon(isCollapsed ? "expand" : "collapse", { size: 14 })),
      icon("folder", { className: "tree-folder-icon" }),
      h("strong", null, folder.name),

    ),
    h("button", {
      className: "mini-action",
      type: "button",
      "aria-label": "新建子项",
      title: "新建",
      onClick: (event) => {
        event.stopPropagation();
        handleAction("toggle-create-menu", folder.id);
      }
    }, icon("add", { size: 15 })),
    state.openCreateMenu === folder.id
      ? h("div", { className: "create-menu" },
          h("button", { onClick: () => handleAction("new-folder-in-folder", folder.id) }, "新建文件夹"),
          h("button", { onClick: () => handleAction("new-note-in-folder", folder.id) }, "新建文档"),
          h("button", { className: "danger-menu-item", onClick: () => handleAction("delete-folder", folder.id) }, "删除文件夹")
        )
      : null,
    isCollapsed ? null : h("div", { role: "group" },
      notes.map((note) => renderNoteItem(state, note, depth + 1, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard)),
      children.map((child) => renderFolder(state, child, depth + 1, visibleNotes, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard))
    )
  );
}

function tableSelectionInfo(editor) {
  const selection = editor?.state?.selection;
  if (selection?.$anchorCell) {
    const $cell = selection.$anchorCell;
    const rowDepth = $cell.depth;
    const tableDepth = rowDepth - 1;
    return {
      table: $cell.node(tableDepth),
      tablePos: $cell.before(tableDepth),
      cellPos: $cell.pos,
      rowIndex: $cell.index(tableDepth),
      columnIndex: $cell.index(rowDepth)
    };
  }
  const $from = selection?.$from;
  if (!$from) return null;
  let tableDepth = -1;
  let rowDepth = -1;
  let cellDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "table" && tableDepth < 0) tableDepth = depth;
    if (name === "tableRow" && rowDepth < 0) rowDepth = depth;
    if ((name === "tableCell" || name === "tableHeader") && cellDepth < 0) cellDepth = depth;
  }
  if (tableDepth < 0 || rowDepth < 0 || cellDepth < 0) return null;
  const table = $from.node(tableDepth);
  const row = $from.node(rowDepth);
  const cell = $from.node(cellDepth);
  return {
    table,
    tablePos: $from.before(tableDepth),
    cellPos: $from.before(cellDepth),
    rowIndex: table.content.content.findIndex((item) => item === row),
    columnIndex: row.content.content.findIndex((item) => item === cell)
  };
}

function tableSelectionKind(editor) {
  const selection = editor?.state?.selection;
  if (!selection?.$anchorCell || !selection?.$headCell) return null;
  const coordinates = ($cell) => {
    const rowDepth = $cell.depth;
    const tableDepth = rowDepth - 1;
    return { row: $cell.index(tableDepth), column: $cell.index(rowDepth) };
  };
  const anchor = coordinates(selection.$anchorCell);
  const head = coordinates(selection.$headCell);
  if (anchor.row === head.row) return "row";
  if (anchor.column === head.column) return "column";
  return null;
}

function sortActiveTable(editor, direction) {
  const info = tableSelectionInfo(editor);
  if (!info || info.columnIndex < 0) return false;
  const rows = info.table.content.content.map((row, index) => ({
    id: index,
    row,
    values: row.content.content.map((cell) => cell.textContent)
  }));
  const orderedRows = sortTableRows(rows, info.columnIndex, direction).map((item) => item.row);
  let content = info.table.content;
  orderedRows.forEach((row, index) => {
    content = content.replaceChild(index, row);
  });
  const transaction = editor.state.tr.replaceWith(info.tablePos, info.tablePos + info.table.nodeSize, info.table.copy(content));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function applyTableCommand(editor, command) {
  if (!editor) return false;
  const chain = editor.chain().focus();
  const tableInfo = tableSelectionInfo(editor);
  if (command === "paragraph") return chain.setParagraph().run();
  if (command === "h1") return chain.toggleHeading({ level: 1 }).run();
  if (command === "h2") return chain.toggleHeading({ level: 2 }).run();
  if (command === "h3") return chain.toggleHeading({ level: 3 }).run();
  if (command === "add-row-before") return chain.addRowBefore().run();
  if (command === "add-row-after") return chain.addRowAfter().run();
  if (command === "delete-row" && tableInfo?.table.childCount === 1) return chain.deleteTable().run();
  if (command === "delete-row") return chain.deleteRow().run();
  if (command === "add-column-before") return chain.addColumnBefore().run();
  if (command === "add-column-after") return chain.addColumnAfter().run();
  if (command === "delete-column") return chain.deleteColumn().run();
  if (command === "toggle-header-row") return chain.toggleHeaderRow().run();
  if (command === "toggle-header-column") return chain.toggleHeaderColumn().run();
  if (command === "merge-or-split") return chain.mergeOrSplit().run();
  if (command === "bold") return chain.toggleBold().run();
  if (command === "strike") return chain.toggleStrike().run();
  if (command === "italic") return chain.toggleItalic().run();
  if (command === "underline") return chain.toggleUnderline().run();
  if (command === "code") return chain.toggleCode().run();
  if (command === "bullet-list") return chain.toggleBulletList().run();
  if (command === "ordered-list") return chain.toggleOrderedList().run();
  if (command === "task-list") return chain.toggleTaskList().run();
  if (command === "code-block") return chain.toggleCodeBlock().run();
  if (command === "link") {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("链接地址", previous);
    if (url === null) return false;
    return url ? chain.extendMarkRange("link").setLink({ href: url }).run() : chain.unsetLink().run();
  }
  if (command === "text-color-reset") return chain.unsetColor().run();
  if (command === "highlight-reset") return chain.unsetHighlight().run();
  if (command.startsWith("text-color-")) return chain.setColor(command.slice(11)).run();
  if (command.startsWith("highlight-")) return chain.setHighlight({ color: command.slice(10) }).run();
  if (command.startsWith("align-")) return chain.setCellAttribute("textAlign", command.slice(6)).run();
  if (command.startsWith("vertical-align-")) return chain.setCellAttribute("verticalAlign", command.slice(15)).run();
  if (command === "background-reset") return chain.setCellAttribute("backgroundColor", null).run();
  if (command.startsWith("background-")) return chain.setCellAttribute("backgroundColor", command.slice(11)).run();
  if (command === "sort-ascending") return sortActiveTable(editor, "asc");
  if (command === "sort-descending") return sortActiveTable(editor, "desc");
  if (command === "delete-table") return chain.deleteTable().run();
  return false;
}

function highlightTableLine(table, kind, index) {
  if (!table) return;
  table.querySelectorAll(".table-line-selected").forEach((cell) => cell.classList.remove("table-line-selected"));
  const cells = kind === "row"
    ? Array.from(table.rows[index]?.cells || [])
    : Array.from(table.rows).map((row) => row.cells[index]).filter(Boolean);
  cells.forEach((cell) => cell.classList.add("table-line-selected"));
}

function tableCellPosition(editor, cell) {
  if (!cell) return null;
  const position = editor.view.posAtDOM(cell, 0);
  const $position = editor.state.doc.resolve(position);
  const nextRole = $position.nodeAfter?.type?.spec?.tableRole;
  if (nextRole === "cell" || nextRole === "header_cell") return $position.pos;
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const role = $position.node(depth).type.spec.tableRole;
    if (role === "cell" || role === "header_cell") return $position.before(depth);
  }
  return null;
}

function tableColumnTargets(table) {
  const tableRect = table.getBoundingClientRect();
  const cells = Array.from(table.querySelectorAll("td, th"));
  const edges = Array.from(new Set(cells.flatMap((cell) => {
    const rect = cell.getBoundingClientRect();
    return [rect.left, rect.right];
  }).filter((edge) => edge >= tableRect.left - 1 && edge <= tableRect.right + 1)))
    .sort((left, right) => left - right);
  return edges.slice(0, -1).map((left, index) => {
    const right = edges[index + 1];
    const midpoint = (left + right) / 2;
    const lineCells = Array.from(table.rows).map((row) => Array.from(row.cells).find((cell) => {
      const rect = cell.getBoundingClientRect();
      return rect.left <= midpoint + 1 && rect.right >= midpoint - 1;
    })).filter(Boolean);
    return {
      cell: lineCells[0] || null,
      cells: lineCells,
      left: left - tableRect.left,
      width: right - left
    };
  }).filter((target) => target.cell && target.width > 1);
}

function persistTableColumnWidth(editor, cells, width) {
  const roundedWidth = Math.round(width);
  const updatedPositions = new Set();
  let transaction = editor.state.tr;
  let changed = false;
  cells.forEach((cell) => {
    const position = tableCellPosition(editor, cell);
    if (position === null || updatedPositions.has(position)) return;
    const node = transaction.doc.nodeAt(position);
    if (!node) return;
    updatedPositions.add(position);
    const colspan = node.attrs.colspan || 1;
    const colwidth = Array.isArray(node.attrs.colwidth) && node.attrs.colwidth.length === colspan
      ? [...node.attrs.colwidth]
      : Array.from({ length: colspan }, () => 0);
    if (colwidth[0] === roundedWidth) return;
    colwidth[0] = roundedWidth;
    transaction = transaction.setNodeMarkup(position, undefined, { ...node.attrs, colwidth });
    changed = true;
  });
  if (changed) editor.view.dispatch(transaction);
  return changed;
}

function selectNativeTableLine(editor, cells, kind, fallbackCell) {
  const anchor = tableCellPosition(editor, cells[0]);
  const head = tableCellPosition(editor, cells.at(-1));
  if (anchor !== null && head !== null) {
    editor.commands.focus();
    if (editor.commands.setCellSelection({ anchor, head })) return true;
  }
  if (!fallbackCell) return false;
  try {
    const paragraph = fallbackCell.querySelector("p") || fallbackCell;
    const position = editor.view.posAtDOM(paragraph, 0);
    if (!editor.commands.setTextSelection(position)) return false;
    return kind === "row" ? editor.commands.selectRow() : editor.commands.selectColumn();
  } catch {
    return false;
  }
}

function FeishuTableControls({ editor, shellRef }) {
  const [version, setVersion] = useState(0);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [activeTable, setActiveTable] = useState(null);
  const [insertTarget, setInsertTarget] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [toolbarMenu, setToolbarMenu] = useState(null);
  useEffect(() => {
    const refresh = () => {
      setVersion((value) => value + 1);
      const nextTableInfo = tableSelectionInfo(editor);
      if (!nextTableInfo || !tableSelectionKind(editor)) setSelectedLine(null);
    };
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  useEffect(() => {
    const lineThreshold = 8;
    const clearHover = () => setHoverTarget(null);
    const updateHover = (event) => {
      const element = event.target instanceof Element ? event.target.closest("td, th") : null;
      if (!element || !editor.view.dom.contains(element)) {
        clearHover();
        return;
      }
      setActiveTable(element.closest("table"));
      const rect = element.getBoundingClientRect();
      const columnEdge = Math.abs(event.clientX - rect.left) <= Math.abs(event.clientX - rect.right) ? "before" : "after";
      const rowEdge = Math.abs(event.clientY - rect.top) <= Math.abs(event.clientY - rect.bottom) ? "before" : "after";
      const nearColumnLine = Math.abs(event.clientX - rect[columnEdge === "before" ? "left" : "right"]) <= lineThreshold;
      const nearRowLine = Math.abs(event.clientY - rect[rowEdge === "before" ? "top" : "bottom"]) <= lineThreshold;
      setHoverTarget((previous) => previous?.element === element
        && previous.nearColumnLine === nearColumnLine
        && previous.nearRowLine === nearRowLine
        && previous.columnEdge === columnEdge
        && previous.rowEdge === rowEdge
        ? previous
        : { element, nearColumnLine, nearRowLine, columnEdge, rowEdge });
    };
    editor.view.dom.addEventListener("mousemove", updateHover);
    return () => editor.view.dom.removeEventListener("mousemove", updateHover);
  }, [editor]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !activeTable) return undefined;
    const railHoverPadding = 32;
    const updateShellHover = (event) => {
      const rect = activeTable.getBoundingClientRect();
      const isInsideTableOrRail = event.clientX >= rect.left - railHoverPadding
        && event.clientX <= rect.right + railHoverPadding
        && event.clientY >= rect.top - railHoverPadding
        && event.clientY <= rect.bottom + railHoverPadding;
      if (isInsideTableOrRail) return;
      setActiveTable(null);
      setHoverTarget(null);
      setInsertTarget(null);
    };
    shell.addEventListener("mousemove", updateShellHover);
    return () => shell.removeEventListener("mousemove", updateShellHover);
  }, [activeTable, shellRef]);

  useEffect(() => {
    if (!selectedLine?.table) return undefined;
    highlightTableLine(selectedLine.table, selectedLine.kind, selectedLine.index);
    return () => selectedLine.table.querySelectorAll(".table-line-selected").forEach((cell) => cell.classList.remove("table-line-selected"));
  }, [selectedLine, version]);

  const tableInfo = tableSelectionInfo(editor);
  const selectedCell = tableInfo ? editor.view.nodeDOM(tableInfo.cellPos) : null;
  const hoveredCell = hoverTarget?.element || null;
  const shell = shellRef.current;
  const hoveredTable = activeTable || hoveredCell?.closest("table") || null;
  const selectedTable = selectedCell?.closest?.("table") || null;
  const table = hoveredTable || selectedLine?.table || selectedTable;
  if (!shell || !table) return null;
  const hoveredCellRect = hoveredCell?.getBoundingClientRect() || null;
  const tableRect = table?.getBoundingClientRect() || null;
  const shellRect = shell.getBoundingClientRect();
  if (!tableRect) return null;

  const focusCell = (cell) => {
    if (!cell) return;
    try {
      const paragraph = cell.querySelector("p") || cell;
      editor.chain().focus().setTextSelection(editor.view.posAtDOM(paragraph, 0)).run();
    } catch {
      // Table commands remain available for the existing table selection.
    }
  };

  const selectLine = (kind, index, cell, cells) => {
    if (!selectNativeTableLine(editor, cells, kind, cell)) return;
    highlightTableLine(table, kind, index);
    setSelectedLine({ kind, index, table, cell });
  };
  const run = (command, context = {}) => {
    if (context.focusCell) focusCell(context.cell || hoveredCell);
    const applied = applyTableCommand(editor, command);
    if (applied) setVersion((value) => value + 1);
    if (command === "delete-row" || command === "delete-column") setSelectedLine(null);
    return applied;
  };
  const tableLeft = tableRect.left - shellRect.left;
  const tableTop = tableRect.top - shellRect.top;
  const tableWidth = tableRect.width;
  const tableHeight = tableRect.height;
  const railViewportRect = table.closest(".tableWrapper")?.getBoundingClientRect() || tableRect;
  const visibleTableLeft = Math.max(tableRect.left, railViewportRect.left);
  const visibleTableRight = Math.min(tableRect.right, railViewportRect.right);
  const visibleTableWidth = Math.max(0, visibleTableRight - visibleTableLeft);
  const visibleTableOffset = visibleTableLeft - tableRect.left;
  const columnLineLeft = hoveredCellRect ? (hoverTarget?.columnEdge === "before" ? hoveredCellRect.left : hoveredCellRect.right) - shellRect.left : 0;
  const rowLineTop = hoveredCellRect ? (hoverTarget?.rowEdge === "before" ? hoveredCellRect.top : hoveredCellRect.bottom) - shellRect.top : 0;
  const columnTargets = tableColumnTargets(table);
  const rowCells = Array.from(table.rows).map((row) => row.cells[0]).filter(Boolean);
  const updateInsertTarget = (kind, event) => {
    const offset = kind === "column"
      ? event.clientX - visibleTableLeft + visibleTableOffset
      : event.clientY - tableRect.top;
    const index = kind === "column"
      ? columnTargets.findIndex((target) => offset >= target.left && offset <= target.left + target.width)
      : rowCells.findIndex((cell) => {
        const rect = cell.getBoundingClientRect();
        return offset >= rect.top - tableRect.top && offset <= rect.bottom - tableRect.top;
      });
    setInsertTarget((previous) => {
      if (index < 0) return previous ? null : previous;
      return previous?.kind === kind && previous.index === index ? previous : { kind, index };
    });
  };
  const activeColumnInsert = insertTarget?.kind === "column" ? columnTargets[insertTarget.index] : null;
  const activeRowInsert = insertTarget?.kind === "row" ? rowCells[insertTarget.index] : null;
  const activeRowInsertRect = activeRowInsert?.getBoundingClientRect() || null;
  const startColumnResize = (event, index) => {
    const leftTarget = columnTargets[index];
    const rightTarget = columnTargets[index + 1];
    if (!leftTarget || !rightTarget) return;
    event.preventDefault();
    event.stopPropagation();
    const state = {
      table,
      index,
      leftCells: leftTarget.cells,
      rightCells: rightTarget.cells,
      leftWidth: leftTarget.width,
      rightWidth: rightTarget.width,
      startX: event.clientX
    };
    const updatePreview = (moveEvent) => {
      const requestedDelta = moveEvent.clientX - state.startX;
      const delta = Math.min(state.rightWidth - 96, Math.max(96 - state.leftWidth, requestedDelta));
      const currentWidth = Math.max(96, state.leftWidth + delta);
      const nextWidth = Math.max(96, state.rightWidth - delta);
      const columns = state.table.querySelectorAll("colgroup col");
      if (columns[state.index]) columns[state.index].style.width = `${currentWidth}px`;
      if (columns[state.index + 1]) columns[state.index + 1].style.width = `${nextWidth}px`;
      state.currentWidth = currentWidth;
      state.nextWidth = nextWidth;
    };
    const finishResize = (upEvent) => {
      updatePreview(upEvent);
      persistTableColumnWidth(editor, state.leftCells, state.currentWidth);
      persistTableColumnWidth(editor, state.rightCells, state.nextWidth);
      setVersion((value) => value + 1);
      window.removeEventListener("pointermove", updatePreview);
      window.removeEventListener("pointerup", finishResize);
    };
    window.addEventListener("pointermove", updatePreview);
    window.addEventListener("pointerup", finishResize);
  };
  const nativeLineKind = tableSelectionKind(editor);
  const activeLine = nativeLineKind ? { kind: nativeLineKind, table, cell: selectedCell } : selectedLine;
  const hasTableTextSelection = Boolean(tableInfo && !editor.state.selection.empty && !nativeLineKind);
  const openToolbarMenu = (event, type) => {
    event.preventDefault();
    event.stopPropagation();
    const left = event.currentTarget.offsetLeft;
    setToolbarMenu((current) => current?.type === type ? null : { type, left });
  };
  const activate = (event, command, context = {}) => {
    event.preventDefault();
    event.stopPropagation();
    run(command, context);
    setToolbarMenu(null);
  };
  const formatActions = [["bold", "B", "加粗"], ["strike", "S", "删除线"], ["italic", "I", "斜体"], ["underline", "U", "下划线"], ["link", "↗", "链接"], ["code", "</>", "行内代码"]];

  return h("div", { className: "feishu-table-controls", onMouseDown: (event) => event.preventDefault() },
    hoveredTable ? h(React.Fragment, null,
      h("div", {
        className: "table-top-rail",
        style: { left: `${visibleTableLeft - shellRect.left}px`, top: `${tableTop - 26}px`, width: `${visibleTableWidth}px` },
        onPointerMove: (event) => updateInsertTarget("column", event),
        onPointerLeave: () => setInsertTarget((current) => current?.kind === "column" ? null : current)
      }, columnTargets.map((target, index) => {
        const { cell } = target;
        const selectorLeft = target.left - visibleTableOffset;
        const selectorRight = selectorLeft + target.width;
        if (selectorRight <= 0 || selectorLeft >= visibleTableWidth) return null;
        return h("button", {
          className: "table-column-selector",
          key: `column-${index}`,
          title: "选中列",
          style: { left: `${Math.max(0, selectorLeft)}px`, width: `${Math.min(selectorRight, visibleTableWidth) - Math.max(0, selectorLeft)}px` },
          onPointerDown: (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectLine("column", index, cell, target.cells);
          }
        });
      }), activeColumnInsert ? h("button", {
        className: "table-insert-trigger table-column-insert-trigger",
        title: "在右侧插入列",
        style: { left: `${activeColumnInsert.left + activeColumnInsert.width - visibleTableOffset}px`, top: "50%" },
        onPointerDown: (event) => {
          event.preventDefault();
          event.stopPropagation();
          run("add-column-after", { cell: activeColumnInsert.cell, focusCell: true });
        }
      }, "+") : null),
      h("div", {
        className: "table-left-rail",
        style: { left: `${tableLeft - 26}px`, top: `${tableTop}px`, height: `${tableHeight}px` },
        onPointerMove: (event) => updateInsertTarget("row", event),
        onPointerLeave: () => setInsertTarget((current) => current?.kind === "row" ? null : current)
      }, rowCells.map((cell, index) => {
        const rect = cell.getBoundingClientRect();
        const cells = Array.from(table.rows[index]?.cells || []);
        return h("button", {
          className: "table-row-selector",
          key: `row-${index}`,
          title: "选中行",
          style: { top: `${rect.top - tableRect.top}px`, height: `${rect.height}px` },
          onPointerDown: (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectLine("row", index, cell, cells);
          }
        });
      }), activeRowInsert && activeRowInsertRect ? h("button", {
        className: "table-insert-trigger table-row-insert-trigger",
        title: "在下方插入行",
        style: { left: "50%", top: `${activeRowInsertRect.bottom - tableRect.top}px` },
        onPointerDown: (event) => {
          event.preventDefault();
          event.stopPropagation();
          run("add-row-after", { cell: activeRowInsert, focusCell: true });
        }
      }, "+") : null),
      columnTargets.slice(0, -1).map((target, index) => {
        const handleLeft = tableLeft + target.left + target.width - 3;
        if (handleLeft < visibleTableLeft - shellRect.left - 3 || handleLeft > visibleTableRight - shellRect.left + 3) return null;
        return h("div", {
          className: "table-column-drag-handle",
          key: `resize-${index}`,
          title: "拖拽调整列宽",
          style: {
            left: `${handleLeft}px`,
            top: `${tableTop}px`,
            height: `${tableHeight}px`
          },
          onPointerDown: (event) => startColumnResize(event, index)
        });
      })
    ) : null,
    activeLine || hasTableTextSelection ? (() => {
      const lineRect = activeLine?.cell?.getBoundingClientRect() || null;
      const textRect = hasTableTextSelection ? getSelectionToolbarRect(editor.view.dom) : null;
      const toolbarAnchorRect = textRect || lineRect || tableRect;
      const textColors = ["#245bdb", "#1f2329", "#f54a45", "#f59f00", "#de7b00", "#2f9e44", "#2563eb", "#7c3aed"];
      const backgroundColors = ["transparent", "#f2f3f5", "#ffe8e8", "#ffe8c2", "#fff4b8", "#d9f7d8", "#dbe7ff", "#e8dcff", "#e4e7eb", "#c9cdd4", "#ff6b5f", "#ff9f43", "#ffd43b", "#51cf66", "#91a7ff", "#b197fc"];
      const menuItems = toolbarMenu?.type === "style"
        ? [
          { command: "paragraph", icon: "T", label: "\u6b63\u6587" },
          { command: "h1", icon: "H1", label: "\u4e00\u7ea7\u6807\u9898" },
          { command: "h2", icon: "H2", label: "\u4e8c\u7ea7\u6807\u9898" },
          { command: "h3", icon: "H3", label: "\u4e09\u7ea7\u6807\u9898" },
          { divider: true },
          { command: "ordered-list", icon: "1.", label: "\u6709\u5e8f\u5217\u8868" },
          { command: "bullet-list", icon: "\u2022", label: "\u65e0\u5e8f\u5217\u8868" },
          { command: "task-list", icon: "\u2611", label: "\u4efb\u52a1" },
          { command: "code-block", icon: "{}", label: "\u4ee3\u7801\u5757" }
        ]
        : toolbarMenu?.type === "align"
          ? [
            { command: "align-left", icon: "L", label: "\u5de6\u5bf9\u9f50" },
            { command: "align-center", icon: "C", label: "\u5c45\u4e2d\u5bf9\u9f50" },
            { command: "align-right", icon: "R", label: "\u53f3\u5bf9\u9f50" },
            { divider: true },
            { command: "vertical-align-top", icon: "T", label: "\u9876\u90e8\u5bf9\u9f50" },
            { command: "vertical-align-middle", icon: "M", label: "\u5782\u76f4\u5c45\u4e2d" },
            { command: "vertical-align-bottom", icon: "B", label: "\u5e95\u90e8\u5bf9\u9f50" }
          ]
          : [];
      const renderToolbarMenu = () => {
        if (!toolbarMenu) return null;
        if (toolbarMenu.type === "textColor") {
          return h("div", { className: "feishu-color-panel table-toolbar-color-panel", style: { left: `${toolbarMenu.left}px` }, onMouseDown: (event) => event.preventDefault() },
            h("div", { className: "feishu-color-section" },
              h("div", { className: "feishu-color-title" }, "\u5b57\u4f53\u989c\u8272"),
              h("div", { className: "feishu-color-row" }, textColors.map((color) => h("button", {
                key: "table-text-" + color,
                className: "feishu-text-color-swatch",
                style: { color },
                title: color,
                onPointerDown: (event) => activate(event, "text-color-" + color, activeLine || {})
              }, "A")))
            ),
            h("div", { className: "feishu-color-section" },
              h("div", { className: "feishu-color-title" }, "\u80cc\u666f\u989c\u8272"),
              h("div", { className: "feishu-color-grid" }, backgroundColors.map((color) => h("button", {
                key: "table-highlight-" + color,
                className: "feishu-bg-color-swatch " + (color === "transparent" ? "empty" : ""),
                style: { background: color === "transparent" ? "#ffffff" : color },
                title: color === "transparent" ? "\u65e0\u80cc\u666f" : color,
                onPointerDown: (event) => activate(event, color === "transparent" ? "highlight-reset" : "highlight-" + color, activeLine || {})
              })))
            )
          );
        }
        if (toolbarMenu.type === "cellBackground") {
          return h("div", { className: "feishu-color-panel table-toolbar-color-panel", style: { left: `${toolbarMenu.left}px` }, onMouseDown: (event) => event.preventDefault() },
            h("div", { className: "feishu-color-section" },
              h("div", { className: "feishu-color-title" }, "\u5355\u5143\u683c\u80cc\u666f\u989c\u8272"),
              h("div", { className: "feishu-color-grid" }, backgroundColors.map((color) => h("button", {
                key: "table-background-" + color,
                className: "feishu-bg-color-swatch " + (color === "transparent" ? "empty" : ""),
                style: { background: color === "transparent" ? "#ffffff" : color },
                title: color === "transparent" ? "\u65e0\u586b\u5145" : color,
                onPointerDown: (event) => activate(event, color === "transparent" ? "background-reset" : "background-" + color, activeLine || {})
              })))
            )
          );
        }
        return h("div", { className: "table-toolbar-popover", style: { left: `${toolbarMenu.left}px` } }, menuItems.map((item, index) => item.divider
          ? h("span", { className: "table-toolbar-popover-divider", key: `divider-${index}` })
          : h("button", { key: item.command, onPointerDown: (event) => activate(event, item.command, activeLine || {}) }, h("span", { className: "table-toolbar-menu-icon" }, item.icon), item.label)));
      };
      return h("div", {
      className: "table-selection-toolbar",
      style: {
        left: `${Math.max(8, toolbarAnchorRect.left - shellRect.left)}px`,
        top: `${Math.max(4, toolbarAnchorRect.top - shellRect.top - 48)}px`
      }
    },
      h("button", {
        className: "table-toolbar-menu-trigger",
        title: "文本样式",
        onPointerDown: (event) => openToolbarMenu(event, "style")
      }, "T⌄"),
      h("button", {
        className: "table-toolbar-menu-trigger",
        title: "对齐",
        onPointerDown: (event) => openToolbarMenu(event, "align")
      }, "≡⌄"),
      h("span", { className: "table-toolbar-divider" }),
      formatActions.map(([command, label, title]) => h("button", {
        key: command,
        title,
        onPointerDown: (event) => activate(event, command, activeLine || {})
      }, label)),
      h("button", {
        className: "table-toolbar-menu-trigger table-text-color-trigger",
        title: "\u6587\u5b57\u989c\u8272",
        onPointerDown: (event) => openToolbarMenu(event, "textColor")
      }, "A v"),
      h("button", {
        className: "table-toolbar-menu-trigger table-cell-background-trigger",
        title: "\u5355\u5143\u683c\u80cc\u666f\u989c\u8272",
        onPointerDown: (event) => openToolbarMenu(event, "cellBackground")
      }, "Bg v"),
      activeLine ? h("span", { className: "table-toolbar-divider" }) : null,
      activeLine ? h("button", { title: "合并或拆分单元格", onPointerDown: (event) => activate(event, "merge-or-split", activeLine) }, "▦") : null,
      activeLine ? h("button", {
        className: "table-delete-action",
        title: activeLine.kind === "row" ? "删除行" : "删除列",
        onPointerDown: (event) => activate(event, activeLine.kind === "row" ? "delete-row" : "delete-column", activeLine)
      }, "⌫") : null,
      renderToolbarMenu()
    ); })() : null
  );
}

function TableInsertGrid({ position, onSelect }) {
  const [selected, setSelected] = useState({ rows: 3, cols: 3 });
  const cells = [];
  for (let rows = 1; rows <= 6; rows += 1) {
    for (let cols = 1; cols <= 6; cols += 1) {
      const active = rows <= selected.rows && cols <= selected.cols;
      cells.push(h("button", {
        key: `${rows}-${cols}`,
        className: active ? "active" : "",
        title: `${rows} 行 ${cols} 列`,
        onMouseEnter: () => setSelected({ rows, cols }),
        onClick: () => onSelect(rows, cols)
      }));
    }
  }
  return h("div", {
    className: "table-insert-grid",
    style: { left: `${position.left}px`, top: `${position.top}px` },
    onMouseDown: (event) => event.preventDefault()
  },
    h("div", { className: "table-grid-cells" }, cells),
    h("div", { className: "table-grid-size" }, `${selected.rows} × ${selected.cols}`)
  );
}

function renderNoteItem(state, note, depth, selectNote, handleAction, treeDrag, dragTarget, treeKeyboard) {
  const isActive = note.id === state.activeId;
  return h("div", { className: "tree-section", key: note.id },
    h("button", {
      className: `tree-note indent-${Math.min(depth, 3)} ${isActive ? "active" : ""} ${dragTarget?.type === "note" && dragTarget.id === note.id ? `drop-${dragTarget.position}` : ""}`,
      role: "treeitem",
      "aria-level": depth + 1,
      "aria-current": isActive ? "page" : undefined,
      draggable: !treeDrag.disabled,
      onDragStart: (event) => treeDrag.start(event, { type: "note", id: note.id }),
      "data-tree-id": note.id,
      tabIndex: treeKeyboard.focusedId === note.id ? 0 : -1,
      onFocus: () => treeKeyboard.onFocus(note.id),
      onKeyDown: (event) => treeKeyboard.onKeyDown(event),
      onDragOver: (event) => treeDrag.over(event, { type: "note", id: note.id }),
      onDragLeave: treeDrag.leave,
      onDragEnd: treeDrag.end,
      onDrop: (event) => treeDrag.drop(event, { type: "note", id: note.id }),
      onClick: () => selectNote(note.id),
      onDoubleClick: () => handleAction("rename-note", note.id)
    },
      h("span", { className: "tree-note-icon-wrap" },
        icon("file", { className: "tree-note-icon" }),
        note.dirty ? h("span", { className: "tree-note-dirty", title: "本地草稿" }) : null
      ),
      h("strong", null, note.title || "未命名笔记"),

    ),
    h("button", {
      className: "mini-action",
      type: "button",
      "aria-label": "更多文档操作",
      title: "更多",
      onClick: (event) => {
        event.stopPropagation();
        handleAction("toggle-create-menu", note.id);
      }
    }, icon("more", { size: 16 })),
    state.openCreateMenu === note.id
      ? h("div", { className: "create-menu" },
          h("button", { className: "danger-menu-item", onClick: () => handleAction("delete-note", note.id) }, "删除文档")
        )
      : null
  );
}

function buildDraftDeletionSummary(localState, publishedState) {
  const publishedById = new Map((publishedState.notes || []).map((item) => [item.id, item]));
  const localById = new Map((localState.notes || []).map((item) => [item.id, item]));
  const dirtyNotes = (localState.notes || [])
    .filter((item) => item.dirty || !item.publishedAt)
    .map((item) => item.title || "未命名文档");
  const localOnlyNotes = (localState.notes || [])
    .filter((item) => !publishedById.has(item.id))
    .map((item) => item.title || "未命名文档");
  const restoredNotes = (publishedState.notes || [])
    .filter((item) => !localById.has(item.id))
    .map((item) => item.title || "未命名文档");
  const changedPublishedNotes = (localState.notes || [])
    .filter((item) => {
      const published = publishedById.get(item.id);
      if (!published) return false;
      return item.dirty
        || item.title !== published.title
        || item.folderId !== published.folderId
        || normalizeHtml(item.html || blocksToHtml(item.blocks)) !== normalizeHtml(published.html || blocksToHtml(published.blocks));
    })
    .map((item) => item.title || "未命名文档");
  const folderChanged = JSON.stringify(localState.folders || []) !== JSON.stringify(publishedState.folders || []);
  return {
    dirtyNotes: uniqueValues(dirtyNotes),
    localOnlyNotes: uniqueValues(localOnlyNotes),
    restoredNotes: uniqueValues(restoredNotes),
    changedPublishedNotes: uniqueValues(changedPublishedNotes),
    deletedTags: uniqueTags(localState.deletedTags || []),
    folderChanged,
    hasChanges: dirtyNotes.length > 0
      || localOnlyNotes.length > 0
      || restoredNotes.length > 0
      || changedPublishedNotes.length > 0
      || Boolean(localState.deletedTags?.length)
      || folderChanged
  };
}
function buildPublishSummary(state, notes = state.notes) {
  const dirtyNotes = notes.filter((item) => item.dirty || !item.publishedAt);
  const renamedOrMovedNotes = notes.filter((item) => !item.dirty && item.publishedAt);
  const folders = state.folders || [];
  const tagNames = uniqueTags(notes.flatMap((item) => ensureDefaultTags(item.tags)));
  const deletedTags = state.deletedTags || [];
  return {
    totalNotes: notes.length,
    dirtyNotes: dirtyNotes.map((item) => item.title || "未命名文档"),
    existingNotes: renamedOrMovedNotes.map((item) => item.title || "未命名文档"),
    folderCount: folders.length,
    folderNames: folders.map((item) => item.name || "未命名文件夹"),
    tagNames,
    deletedTags
  };
}

function summaryList(items, emptyText) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return h("p", { className: "empty" }, emptyText);
  return h("ul", { className: "publish-summary-list" }, values.slice(0, 12).map((item) => h("li", { key: item }, item)),
    values.length > 12 ? h("li", { key: "more" }, `还有 ${values.length - 12} 项...`) : null
  );
}
function PublishReviewSheet({ state, handleAction, returnFocusSelector }) {
  const closeButtonRef = useRef(null);
  const sheetRef = useRef(null);
  const review = state.modalContext?.review || { changes: [], selectedIds: [], localState: state, remoteState: state };
  const destination = { ...state.settings, ...(state.modalContext?.settings || {}) };
  const selectedIds = new Set(review.selectedIds || []);
  const selectedCount = selectedIds.size;
  const selectedNoteIds = new Set(review.changes
    .filter((change) => selectedIds.has(change.id) && change.kind === "note")
    .map((change) => change.noteId));
  const publicTags = uniqueTags((review.localState?.notes || [])
    .filter((note) => selectedNoteIds.has(note.id))
    .flatMap((note) => ensureDefaultTags(note.tags)));
  const isPublishing = state.syncStatus === "publishing";
  const publishError = state.syncStatus === "error" ? state.message : "";
  const typeLabels = { create: "新建", update: "修改", delete: "删除" };

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleAction("close-modal");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(sheetRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])'
      ) || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const explicitReturnFocus = returnFocusSelector ? document.querySelector(returnFocusSelector) : null;
      resolvePublishReviewReturnTarget(explicitReturnFocus, previousFocus)?.focus();
    };
  }, []);

  const changeDescription = (change) => {
    if (change.kind === "folders") return "目录结构会随必要的索引更新发表";
    if (change.kind === "tags") return "已删除标签会从线上标签目录移除";
    return `${typeLabels[change.action] || "修改"}文档`;
  };

  return h("div", {
    className: "modal-backdrop publish-sheet-backdrop",
    onMouseDown: (event) => {
      if (event.target === event.currentTarget) handleAction("close-modal");
    }
  },
    h("section", {
      ref: sheetRef,
      className: "publish-sheet",
      role: "dialog", "aria-modal": "true", "aria-labelledby": "publish-sheet-title",
      onMouseDown: (event) => event.stopPropagation()
    },
      h("header", { className: "publish-sheet-header" },
        h("div", null,
          h("span", { className: "publish-sheet-eyebrow" }, "发布审阅"),
          h("h2", { id: "publish-sheet-title" }, "发表到 GitHub"),
          h("p", null, "确认目标位置与本次公开的内容。")
        ),
        h("button", {
          ref: closeButtonRef,
          type: "button",
          className: "publish-sheet-close",
          "aria-label": "关闭发表审阅",
          onClick: () => handleAction("close-modal")
        }, h(X, { size: 18, strokeWidth: 1.8, "aria-hidden": "true" }))
      ),
      h("div", { className: "publish-sheet-body" },
        h("section", { className: "publish-destination", "aria-label": "发表目标" },
          h("div", null, h("span", null, "仓库"), h("strong", null, `${destination.owner || "—"}/${destination.repo || "—"}`)),
          h("div", null, h("span", null, "分支"), h("strong", null, destination.branch || "main")),
          h("span", { className: "publish-connection-status" }, state.authenticated ? "已连接" : "连接待确认")
        ),
        publishError ? h("div", { className: "publish-sheet-error", role: "alert" }, publishError) : null,
        h("section", { className: "publish-change-section", "aria-labelledby": "publish-changes-title" },
          h("div", { className: "publish-section-heading" },
            h("div", null,
              h("h3", { id: "publish-changes-title" }, "本次变更"),
              h("p", null, "默认选中全部检测到的改动。")
            ),
            h("button", { type: "button", className: "ghost-btn publish-select-toggle", onClick: () => handleAction("toggle-publish-selection") }, "全选 / 取消全选")
          ),
          h("div", { className: "publish-change-list" },
            review.changes.length
              ? review.changes.map((change) => {
                const details = buildPublishChangeDetails(review.localState, review.remoteState, change);
                return h("div", {
                  key: change.id,
                  className: `publish-change-row ${change.action === "delete" ? "is-delete" : ""}`
                },
                h("input", {
                  type: "checkbox",
                  "data-publish-change-id": change.id,
                  checked: selectedIds.has(change.id),
                  onChange: () => handleAction("update-publish-selection-count")
                }),
                h("span", { className: "publish-change-type" }, typeLabels[change.action] || "更新"),
                h("span", { className: "publish-change-content" },
                  h("strong", null, change.title),
                  h("small", null, changeDescription(change))
                ),
                h("details", { className: "publish-change-details" },
                  h("summary", null, "查看发布差异"),
                  details.length
                    ? h("div", { className: "publish-diff-list" }, details.map((detail, index) => h("section", { key: `${change.id}-${detail.label}-${index}`, className: "publish-diff-item" },
                      h("div", { className: "publish-diff-head" },
                        h("strong", null, detail.label),
                        detail.summary ? h("span", null, detail.summary) : null
                      ),
                      h("div", { className: "publish-diff-grid" },
                        h("div", null, h("b", null, "远端"), h("pre", null, detail.remote)),
                        h("div", null, h("b", null, "本地待发表"), h("pre", null, detail.local))
                      )
                    )))
                    : h("p", { className: "empty" }, "没有可展示的字段差异。")
                ));
              })
              : h("p", { className: "empty" }, "没有检测到待发表改动。")
          )
        ),
        h("section", { className: "publish-tags", "aria-labelledby": "publish-tags-title" },
          h("div", null,
            h("h3", { id: "publish-tags-title" }, "公开标签"),
            h("p", null, "随笔记公开，可作为 GitHub 内容索引")
          ),
          h("div", { className: "publish-tag-list" },
            publicTags.length
              ? publicTags.map((tag) => h("span", { key: tag }, tag))
              : h("span", { className: "publish-tags-empty" }, "所选改动不包含公开标签")
          )
        ),
        h("p", { className: "publish-draft-note" }, "未选中的改动会继续保留为本地草稿")
      ),
      h("footer", { className: "publish-sheet-footer" },
        h("span", null, "已选择 ", h("strong", { "data-publish-selected-count": "" }, String(selectedCount)), ` / ${review.changes.length} 项改动`),
        h("div", { className: "publish-sheet-actions" },
          h("button", { type: "button", className: "ghost-btn", onClick: () => handleAction("close-modal") }, "取消"),
          h("button", {
            type: "button",
            className: "primary-btn",
            disabled: isPublishing || !review.changes.length || !selectedCount,
            onClick: () => handleAction("confirm-publish-selected")
          }, isPublishing ? "发表中…" : "确认发表")
        )
      )
    )
  );
}
function renderModal(state, handleAction) {
  if (!state.modal) return null;
  if (state.modal === "name-folder") {
    return modalShell("新文件夹", "文件夹会创建在选中的目录层级下。",
      h("div", { className: "field" }, h("label", null, "文件夹名"), h("input", { "data-modal-input": "folderName", placeholder: "例如 前端学习" })),
      "创建", "confirm-folder", handleAction);
  }
  if (state.modal === "name-note") {
    return modalShell("新文档", "新文档会先保存为本地草稿，发表后进入 GitHub 仓库。",
      h("div", { className: "field" }, h("label", null, "文档标题"), h("input", { "data-modal-input": "noteTitle", placeholder: "例如 阅读摘记" })),
      "创建", "confirm-note", handleAction);
  }
  if (state.modal === "rename-folder") {
    const folder = state.folders.find((item) => item.id === state.modalContext?.folderId);
    return modalShell("重命名文件夹", "修改后，目录层级会立即更新。",
      h("div", { className: "field" }, h("label", null, "文件夹名"), h("input", { "data-modal-input": "renameFolder", defaultValue: folder?.name || "", placeholder: "文件夹名" })),
      "保存", "confirm-rename-folder", handleAction);
  }
  if (state.modal === "rename-note") {
    const note = state.notes.find((item) => item.id === state.modalContext?.noteId);
    return modalShell("重命名文档", "修改后，发表时会同步到文档索引。",
      h("div", { className: "field" }, h("label", null, "文档名"), h("input", { "data-modal-input": "renameNote", defaultValue: note?.title || "", placeholder: "文档名" })),
      "保存", "confirm-rename-note", handleAction);
  }
  if (state.modal === "manage-tag") {
    const isRename = state.modalContext?.mode === "rename" || state.modalContext?.mode === "rename-note";
    const isNoteScopedRename = state.modalContext?.mode === "rename-note";
    const selectedTag = state.modalContext?.selectedTag || "";
    return modalShell(isRename ? "重命名标签" : "新建标签", isRename ? (isNoteScopedRename ? "只修改当前文档里的这个标签，不影响其他笔记。" : "名称会在所有使用此标签的本地笔记中更新，不会触发发表。") : "标签会附加到当前笔记并保存为本地草稿，不会触发发表。",
      h("div", { className: "field" }, h("label", null, "标签名称"), h("input", { "data-local-tag-name": "", "data-modal-initial-focus": "", defaultValue: selectedTag, placeholder: "例如 阅读" })),
      isRename ? "保存" : "创建", "confirm-local-tag", handleAction);
  }

  if (state.modal === "publish-tags") {
    const note = state.notes.find((item) => item.id === state.modalContext?.noteId) || currentNote(state);
    const selectedTags = new Set(ensureDefaultTags(note?.tags));
    const tags = tagCatalog(state);
    return modalShell("选择发表标签", "选择当前笔记要公开的标签，也可以在发表前新增一个标签。",
      h("div", { className: "tag-publish-panel" },
        h("div", { className: "field publish-tag-create" },
          h("label", null, "新增标签"),
          h("input", { "data-publish-tag-new": "", placeholder: "例如 阅读" })
        ),
        h("details", { className: "tag-dropdown" },
          h("summary", null, `选择标签（已选 ${selectedTags.size} 个）`),
          h("div", { className: "tag-choice-list" },
            tags.map((tag) => h("div", { className: "tag-choice", key: tag, "data-tag-row": tag },
              h("label", { className: "tag-check" },
                h("input", { type: "checkbox", "data-tag-selected": "", defaultChecked: selectedTags.has(tag) }),
                h("span", null, "选择")
              ),
              h("span", { className: "tag-choice-name" }, tag)
            ))
          )
        )
      ),
      "继续发表审阅", "confirm-publish-tags", handleAction);
  }
  if (state.modal === "delete-drafts") {
    const summary = state.modalContext?.summary || buildDraftDeletionSummary(state, state.modalContext?.published || state);
    return modalShell(
      "删除本地草稿",
      "此操作只清理当前浏览器里的本地草稿缓存，不会删除 GitHub 上已经发表的内容。确认后页面会恢复为最近一次发表版本。",
      h("div", { className: "publish-summary" },
            h("div", { className: `summary-row ${summary.hasChanges ? "danger" : ""}` }, h("strong", null, "结果"), h("span", null, summary.hasChanges ? "将丢弃本地未发表内容" : "没有检测到本地草稿差异")),
            h("h3", null, "将删除的本地草稿 / 未发表文档"),
            summaryList(summary.dirtyNotes, "没有本地草稿。"),
            h("h3", null, "仅存在于本地的新文档"),
            summaryList(summary.localOnlyNotes, "没有仅存在于本地的文档。"),
            h("h3", null, "将从已发表版本恢复的文档"),
            summaryList(summary.restoredNotes, "没有需要恢复的已发表文档。"),
            h("h3", null, "将回退的已发表文档本地改动"),
            summaryList(summary.changedPublishedNotes, "没有已发表文档的本地改动。"),
            summary.folderChanged ? h("div", { className: "summary-row danger" }, h("strong", null, "目录"), h("span", null, "本地目录改动会恢复为已发表版本")) : null,
            summary.deletedTags.length ? h("div", { className: "summary-row danger" }, h("strong", null, "标签"), h("span", null, summary.deletedTags.join("、"))) : null
          ),
      "确认删除草稿",
      "confirm-delete-drafts",
      handleAction,
      { confirmClassName: "danger-btn" }
    );
  }
  if (state.modal === "publish-review") {
    return h(PublishReviewSheet, { state, handleAction, returnFocusSelector: publishTriggerSelector });
  }
  if (state.modal === "auth") {
    return modalShell("编辑验证", "验证通过后，文档会发表到当前笔记本 GitHub 仓库的 main 分支。",
      h(React.Fragment, null,
        h("div", { className: "field" }, h("label", null, "账号"), h("input", { "data-auth": "account", defaultValue: state.settings.account || state.settings.owner, placeholder: "账号" })),
        h("div", { className: "field" }, h("label", null, "密码"), h("input", { "data-auth": "password", defaultValue: state.settings.token, type: "password", placeholder: "密码" }))
      ),
      "验证", "confirm-auth", handleAction);
  }
  return null;
}

function ModalShell({ title, text, body, confirmText, action, handleAction, confirmClassName = "primary-btn" }) {
  const modalRef = useRef(null);
  const titleId = `modal-title-${action}`;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const modal = modalRef.current;
    modal?.querySelector('[data-modal-initial-focus], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleAction("close-modal");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modal?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])') || []);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
    };
  }, []);
  return h("div", {
    className: "modal-backdrop",
    onMouseDown: (event) => {
      if (event.target === event.currentTarget) handleAction("close-modal");
    }
  },
    h("div", {
      ref: modalRef,
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      onMouseDown: (event) => event.stopPropagation()
    },
      h("h2", { id: titleId }, title),
      h("p", null, text),
      h("div", { className: "form" }, body),
      h("div", { className: "modal-actions" },
        h("button", { type: "button", className: "ghost-btn", onClick: () => handleAction("close-modal") }, "取消"),
        h("button", { type: "button", className: confirmClassName, onClick: () => handleAction(action) }, confirmText)
      )
    )
  );
}

function modalShell(title, text, body, confirmText, action, handleAction, options = {}) {
  return h(ModalShell, { key: action, title, text, body, confirmText, action, handleAction, ...options });
}

async function loadPublishedLibrary() {
  const response = await fetch(`${publishedIndexPath}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return null;
  const index = await response.json();
  const docs = await Promise.all((index.docs || []).map(async (doc) => {
    const docResponse = await fetch(`${trimSlash(doc.file)}?v=${Date.now()}`, { cache: "no-store" });
    if (!docResponse.ok) return null;
    const documentData = await docResponse.json();
    const documentHtml = normalizeHtml(documentData.html || blocksToHtml(documentData.blocks));
    return {
      id: documentData.id || doc.id,
      title: documentData.title || doc.title,
      folderId: doc.folderId || documentData.folderId || null,
      tags: ensureDefaultTags(documentData.tags || doc.tags),
      date: documentData.updatedAt || doc.updatedAt || now(),
      file: doc.file,
      dirty: false,
      publishedAt: documentData.updatedAt || doc.updatedAt || "",
      assets: sanitizePublishedAssets(documentData.assets || [], documentHtml),
      html: documentHtml
    };
  }));
  return migrate({
    ...seed,
    folders: index.folders?.length ? index.folders : seed.folders,
    notes: docs.filter(Boolean)
  });
}

function buildPublishedIndex(state, updatedAt) {
  return {
    version: 1,
    updatedAt,
    folders: state.folders,
    docs: state.notes.map((note) => ({
      id: note.id,
      title: note.title,
      folderId: note.folderId,
      path: folderPath(state, note.folderId),
      tags: ensureDefaultTags(note.tags),
      updatedAt: note.date || updatedAt,
      file: note.file || `notebooks/docs/${slugify(note.title)}.json`
    }))
  };
}

async function putGitHubFile(settings, path, data, message) {
  return putGitHubBase64File(settings, path, encodeBase64Utf8(JSON.stringify(data, null, 2)), message);
}

async function putGitHubBase64File(settings, path, content, message) {
  return putGitHubBase64FileAttempt(settings, path, content, message, false);
}

async function putGitHubBase64FileAttempt(settings, path, content, message, retried) {
  const sha = await getGitHubSha(settings, path);
  const body = {
    message,
    branch: settings.branch,
    content
  };
  if (sha) body.sha = sha;
  const response = await fetch(githubContentUrl(settings, path), {
    method: "PUT",
    headers: githubHeaders(settings.token),
    cache: "no-store",
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await safeJson(response);
    const messageText = detail?.message || `GitHub write failed: ${response.status}`;
    if (!retried && (response.status === 409 || /sha|does not match/i.test(messageText))) {
      return putGitHubBase64FileAttempt(settings, path, content, message, true);
    }
    throw new Error(messageText);
  }
  return response.json();
}

async function loadGitHubPublishedIndex(settings) {
  const data = await getGitHubJsonFile(settings, publishedIndexPath);
  return data && Array.isArray(data.docs) ? data : { docs: [] };
}

async function loadGitHubPublishedLibrary(settings) {
  const index = await loadGitHubPublishedIndex(settings);
  const docs = await Promise.all((index.docs || []).map(async (summary) => {
    const documentData = await getGitHubJsonFile(settings, summary.file)
      || await loadPublishedDocumentFallback(summary);
    return documentData
      ? buildRemotePublishedNote(summary, documentData)
      : buildMissingRemoteNote(summary, now());
  }));
  return {
    folders: index.folders || [],
    notes: docs.filter(Boolean),
    deletedTags: []
  };
}

function buildRemotePublishedNote(summary, documentData) {
  const documentHtml = normalizeHtml(documentData.html || blocksToHtml(documentData.blocks));
  return {
    id: documentData.id || summary.id,
    title: documentData.title || summary.title || "未命名文档",
    folderId: documentData.folderId || summary.folderId || null,
    tags: ensureDefaultTags(documentData.tags || summary.tags),
    date: documentData.updatedAt || summary.updatedAt || now(),
    file: summary.file,
    dirty: false,
    publishedAt: documentData.updatedAt || summary.updatedAt || "",
    assets: sanitizePublishedAssets(documentData.assets || [], documentHtml),
    html: documentHtml
  };
}

async function loadPublishedDocumentFallback(summary) {
  const file = trimSlash(summary?.file || "");
  if (!file) return null;
  try {
    const response = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to load published document fallback", error);
    return null;
  }
}

async function getGitHubJsonFile(settings, path) {
  const response = await fetch(`${githubContentUrl(settings, path)}?ref=${encodeURIComponent(settings.branch)}&v=${Date.now()}`, {
    headers: githubHeaders(settings.token),
    cache: "no-store"
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(detail?.message || `GitHub read failed: ${response.status}`);
  }
  const data = await response.json();
  if (!data?.content) return null;
  return JSON.parse(decodeBase64Utf8(String(data.content).replace(/\s/g, "")));
}

async function deleteStalePublishedDocs(settings, remoteLibrary, nextNotes) {
  const nextFiles = new Set(nextNotes.map((note) => trimSlash(note.file)).filter(Boolean));
  const staleFiles = uniqueValues((remoteLibrary?.docs || [])
    .map((doc) => trimSlash(doc.file))
    .filter((file) => file.startsWith("notebooks/docs/") && file !== publishedIndexPath && !nextFiles.has(file)));
  for (const file of staleFiles) {
    await deleteGitHubFile(settings, file, `Delete stale notebook: ${file}`);
  }
}

async function deleteGitHubFile(settings, path, message) {
  const sha = await getGitHubSha(settings, path);
  if (!sha) return null;
  const response = await fetch(githubContentUrl(settings, path), {
    method: "DELETE",
    headers: githubHeaders(settings.token),
    cache: "no-store",
    body: JSON.stringify({ message, branch: settings.branch, sha })
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await safeJson(response);
    const messageText = detail?.message || `GitHub delete failed: ${response.status}`;
    if (response.status === 409 || /sha|does not match/i.test(messageText)) {
      const latestSha = await getGitHubSha(settings, path);
      if (!latestSha) return null;
      const retry = await fetch(githubContentUrl(settings, path), {
        method: "DELETE",
        headers: githubHeaders(settings.token),
        cache: "no-store",
        body: JSON.stringify({ message, branch: settings.branch, sha: latestSha })
      });
      if (retry.status === 404) return null;
      if (retry.ok) return retry.json();
      const retryDetail = await safeJson(retry);
      throw new Error(retryDetail?.message || `GitHub delete failed: ${retry.status}`);
    }
    throw new Error(messageText);
  }
  return response.json();
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}
function sanitizePublishedAsset(asset) {
  const remotePath = asset?.remotePath || asset?.remoteUrl || "";
  const { content, dataUrl, createdAt, ...rest } = asset || {};
  return {
    ...rest,
    remotePath,
    remoteUrl: remotePath,
    localUrl: remotePath,
    localPath: "",
    cached: true,
    published: true
  };
}

function sanitizePublishedAssets(assets, html) {
  const normalizedHtml = normalizeHtml(html || "<p></p>");
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => {
      const remotePath = asset?.remotePath || asset?.remoteUrl || "";
      return remotePath && normalizedHtml.includes(remotePath);
    })
    .map(sanitizePublishedAsset);
}
async function publishPendingAssets(settings, note) {
  const assets = Array.isArray(note.assets) ? note.assets : [];
  const html = normalizeHtml(note.html || blocksToHtml(note.blocks));
  const referenced = assets.filter((asset) => assetReferenceUrls(asset).some((url) => html.includes(url)));
  const pending = referenced.filter((asset) => asset.localUrl && html.includes(asset.localUrl) && asset.localUrl !== asset.remotePath);
  const published = [];
  for (const asset of pending) {
    const content = await assetContentBase64(asset);
    await putGitHubBase64File(settings, asset.remotePath, content, `Upload notebook asset: ${asset.name || asset.fileName}`);
    published.push({
      ...asset,
      localUrl: asset.localUrl,
      remoteUrl: asset.remotePath,
      content: "",
      dataUrl: "",
      published: true
    });
  }
  const publishedIds = new Set(published.map((asset) => asset.id));
  const preserved = referenced.filter((asset) => !publishedIds.has(asset.id));
  return [...published, ...preserved];
}

async function assetContentBase64(asset) {
  if (asset.content) return asset.content;
  if (asset.dataUrl) return dataUrlToBase64(asset.dataUrl);
  if (!asset.localUrl) throw new Error(`附件缺少本地缓存：${asset.name || asset.fileName}`);
  const response = await fetch(asset.localUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`读取本地附件失败：${asset.name || asset.fileName}`);
  return blobToBase64(await response.blob());
}

function replaceLocalAssetUrls(html, assets) {
  return assets.reduce((content, asset) => {
    if (!asset.localUrl || !asset.remotePath) return content;
    return content.split(asset.localUrl).join(asset.remotePath);
  }, html);
}

async function getGitHubSha(settings, path) {
  const response = await fetch(`${githubContentUrl(settings, path)}?ref=${encodeURIComponent(settings.branch)}&v=${Date.now()}`, {
    headers: githubHeaders(settings.token),
    cache: "no-store"
  });
  if (response.status === 404) return "";
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(detail?.message || `GitHub read failed: ${response.status}`);
  }
  const data = await response.json();
  return data.sha || "";
}
function githubContentUrl(settings, path) {
  const safePath = trimSlash(path).split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${safePath}`;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function loadUiPreferences() {
  try {
    return normalizeUiPreferences(JSON.parse(localStorage.getItem(uiPreferencesStorageKey) || "{}"));
  } catch {
    return normalizeUiPreferences();
  }
}

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.notes && saved?.folders) return saved;
  } catch (error) {
    console.warn(error);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(blockNoteStorageKey));
    if (saved?.notes && saved?.folders) return saved;
  } catch (error) {
    console.warn(error);
  }
  try {
    const legacy = JSON.parse(localStorage.getItem(legacyStorageKey));
    if (legacy?.notes && legacy?.folders) return migrateLegacy(legacy);
  } catch (error) {
    console.warn(error);
  }
  return null;
}

function persist(notebookPersistencePayload) {
  localStorage.setItem(storageKey, notebookPersistencePayload);
}

function migrate(data) {
  const merged = {
    ...seed,
    ...data,
    settings: { ...seed.settings, ...(data.settings || {}) },
    folders: data.folders?.length ? data.folders : structuredClone(seed.folders),
    notes: data.notes?.length ? data.notes : structuredClone(seed.notes)
  };
  merged.notes = merged.notes.map((note) => {
    const noteDirty = Boolean(note.dirty);
    const noteHtml = normalizeHtml(note.html || blocksToHtml(note.blocks));
    const noteAssets = Array.isArray(note.assets) ? note.assets : [];
    return {
      id: note.id || `note-${Date.now()}`,
      title: note.title || "未命名文档",
      folderId: note.folderId || null,
      tags: ensureDefaultTags(note.tags),
      date: note.date || note.updatedAt || now(),
      file: note.file || `notebooks/docs/${slugify(note.title || "untitled")}.json`,
      dirty: noteDirty,
      publishedAt: note.publishedAt || "",
      assets: noteDirty ? noteAssets : sanitizePublishedAssets(noteAssets, noteHtml),
      html: noteHtml
    };
  });
  if (merged.activeId && !merged.notes.some((note) => note.id === merged.activeId)) merged.activeId = "";
  if (!data.view && isNotebookRoute()) {
    merged.view = "library";
    merged.selectedTag = "";
    merged.query = "";
  }
  merged.authenticated = false;
  merged.pendingAuthAction = "";
  merged.settings = {
    ...seed.settings,
    ...merged.settings,
    account: merged.settings?.account || merged.settings?.owner || seed.settings.account,
    owner: merged.settings?.owner || seed.settings.owner,
    repo: merged.settings?.repo || seed.settings.repo,
    branch: "main"
  };
  merged.modal = null;
  merged.openCreateMenu = null;
  merged.collapsedFolders = merged.collapsedFolders && typeof merged.collapsedFolders === "object" && !Array.isArray(merged.collapsedFolders)
    ? merged.collapsedFolders
    : {};
  merged.folderExpansionInitialized = data.folderExpansionInitialized === true;
  if (!merged.folderExpansionInitialized) {
    merged.collapsedFolders = defaultCollapsedFolders(merged.folders, merged.notes, merged.activeId);
    merged.folderExpansionInitialized = true;
  }
  merged.deletedTags = uniqueTags(merged.deletedTags || []);
  merged.syncStatus = merged.syncStatus === "publishing" ? "ready" : merged.syncStatus || "ready";
  return merged;
}

function migrateLegacy(legacy) {
  return {
    ...seed,
    ...legacy,
    settings: seed.settings,
    notes: legacy.notes.map((note) => ({
      id: note.id,
      title: note.title,
      folderId: note.folderId,
      tags: ensureDefaultTags(note.tags),
      date: note.date || now(),
      file: `notebooks/docs/${slugify(note.title || note.id)}.json`,
      dirty: true,
      publishedAt: "",
      assets: [],
      html: normalizeHtml(note.html || "")
    }))
  };
}

function isNotebookRoute() {
  return new URLSearchParams(window.location.search).get("v") === "notebook";
}
const defaultTagOptions = ["AI", "工具", "模型", "自动驾驶", "机器人"];

function tagCatalog(state) {
  const deleted = new Set(uniqueTags(state.deletedTags || []));
  const catalog = uniqueTags([
    ...defaultTagOptions,
    ...state.notes.flatMap((note) => ensureDefaultTags(note.tags))
  ]).filter((tag) => !deleted.has(tag));
  return applyTagOrder(catalog, state.uiPreferences?.tagOrder);
}

function normalizeTagName(tag) {
  const text = String(tag || "").trim();
  if (isRetiredTagName(text)) return "";
  return text;
}

function isRetiredTagName(tag) {
  return /^notes?$/.test(String(tag || "").trim().toLowerCase());
}

function uniqueTags(tags) {
  return Array.from(new Set((tags || []).map(normalizeTagName).filter(Boolean)));
}
function ensureDefaultTags(tags) {
  return uniqueTags(Array.isArray(tags) ? tags : []);
}
function currentNote(state) {
  if (!state.activeId) return null;
  return state.notes.find((item) => item.id === state.activeId) || null;
}

function filteredNotes(state) {
  const query = state.query.trim().toLowerCase();
  const byTag = state.selectedTag
    ? state.notes.filter((note) => (note.tags || []).includes(state.selectedTag))
    : state.notes;
  if (!query) return byTag;
  return byTag.filter((note) => {
    const text = `${note.title} ${folderPath(state, note.folderId)} ${(note.tags || []).join(" ")} ${htmlToText(note.html || blocksToHtml(note.blocks))}`.toLowerCase();
    return text.includes(query);
  });
}

function folderPath(state, folderId) {
  const names = [];
  let cursor = state.folders.find((folder) => folder.id === folderId);
  const guard = new Set();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    names.unshift(cursor.name);
    cursor = state.folders.find((folder) => folder.id === cursor.parentId);
  }
  return names.join("/");
}

function countNotes(state, folderId, visibleNotes) {
  const childIds = state.folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id);
  return visibleNotes.filter((note) => note.folderId === folderId).length
    + childIds.reduce((sum, id) => sum + countNotes(state, id, visibleNotes), 0);
}

function normalizeBlocks(blocks) {
  return Array.isArray(blocks) && blocks.length ? blocks : [paragraphBlock("")];
}

function paragraphBlock(text) {
  return {
    type: "paragraph",
    props: {},
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: []
  };
}

function headingBlock(text, level) {
  return {
    type: "heading",
    props: { level },
    content: [{ type: "text", text, styles: {} }],
    children: []
  };
}

function htmlToBlocks(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  const blocks = [];
  template.content.childNodes.forEach((node) => {
    const text = (node.textContent || "").trim();
    if (!text) return;
    if (node.nodeType === Node.ELEMENT_NODE && ["H1", "H2", "H3"].includes(node.tagName)) {
      blocks.push(headingBlock(text, node.tagName === "H1" ? 1 : node.tagName === "H2" ? 2 : 3));
    } else {
      blocks.push(paragraphBlock(text));
    }
  });
  return blocks.length ? blocks : [paragraphBlock("")];
}

function blocksToHtml(blocks) {
  return normalizeBlocks(blocks).map((block) => {
    const text = escapeHtml(Array.isArray(block.content) ? block.content.map((item) => item.text || "").join("") : "");
    const children = Array.isArray(block.children) && block.children.length ? blocksToHtml(block.children) : "";
    if (block.type === "heading") {
      const level = Math.min(3, Math.max(1, Number(block.props?.level || 2)));
      return `<h${level}>${text}</h${level}>${children}`;
    }
    if (block.type === "bulletListItem") return `<ul><li>${text}</li></ul>${children}`;
    if (block.type === "numberedListItem") return `<ol><li>${text}</li></ol>${children}`;
    if (block.type === "quote") return `<blockquote>${text}</blockquote>${children}`;
    if (block.type === "codeBlock") return `<pre><code>${text}</code></pre>${children}`;
    return `<p>${text || "<br>"}</p>${children}`;
  }).join("");
}

function normalizeHtml(html) {
  return sanitizeHtml(restoreMarkdownMathInHtml(html || "<p></p>"));
}

function normalizeDraftHtml(nextHtml, currentHtml, assets = []) {
  const normalizedNext = normalizeHtml(nextHtml);
  const normalizedCurrent = normalizeHtml(currentHtml || "<p></p>");
  const recentAssets = (Array.isArray(assets) ? assets : []).filter((asset) => {
    const createdAt = Number(asset.createdAt || 0);
    return createdAt && Date.now() - createdAt < 5000;
  });
  const droppedRecentAsset = recentAssets.some((asset) => {
    const urls = assetReferenceUrls(asset);
    return urls.some((url) => normalizedCurrent.includes(url))
      && !urls.some((url) => normalizedNext.includes(url));
  });
  return droppedRecentAsset ? normalizedCurrent : normalizedNext;
}

function assetReferenceUrls(asset) {
  return [asset?.localUrl, asset?.remoteUrl, asset?.remotePath, asset?.dataUrl]
    .filter((url) => typeof url === "string" && url);
}

function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  template.content.querySelectorAll("script, iframe, object, embed, style").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      if (attr.name.startsWith("on")) node.removeAttribute(attr.name);
      if (["href", "src"].includes(attr.name) && /^\s*javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML || "<p></p>";
}

function htmlToText(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  return template.content.textContent || "";
}

function blocksToText(blocks) {
  return normalizeBlocks(blocks).map((block) => {
    const content = Array.isArray(block.content) ? block.content.map((item) => item.text || "").join("") : "";
    const children = Array.isArray(block.children) ? blocksToText(block.children) : "";
    return `${content} ${children}`;
  }).join(" ");
}

function slugify(value) {
  const slug = String(value || "untitled")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `note-${Date.now()}`;
}

function trimSlash(path) {
  return String(path || "").replace(/^\/+|\/+$/g, "");
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function inferOwner() {
  const host = window.location.hostname;
  if (host.endsWith(".github.io")) return host.replace(".github.io", "");
  return "xerifg";
}

function inferRepo() {
  const host = window.location.hostname;
  if (host.endsWith(".github.io")) return host;
  return "xerifg.github.io";
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}
function dataUrlToBase64(dataUrl) {
  return String(dataUrl || "").split(",", 2)[1] || "";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(dataUrlToBase64(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "#7cc7ff").replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((item) => item + item).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(value, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

createRoot(document.getElementById("app")).render(h(App));
