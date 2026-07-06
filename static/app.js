import React, { useCallback, useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { Editor, Node, mergeAttributes } from "https://esm.sh/@tiptap/core@2.11.7";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.11.7";
import Underline from "https://esm.sh/@tiptap/extension-underline@2.11.7";
import Link from "https://esm.sh/@tiptap/extension-link@2.11.7";
import Highlight from "https://esm.sh/@tiptap/extension-highlight@2.11.7";
import Image from "https://esm.sh/@tiptap/extension-image@2.11.7";
import Placeholder from "https://esm.sh/@tiptap/extension-placeholder@2.11.7";
import Table from "https://esm.sh/@tiptap/extension-table@2.11.7";
import TableRow from "https://esm.sh/@tiptap/extension-table-row@2.11.7";
import TableHeader from "https://esm.sh/@tiptap/extension-table-header@2.11.7";
import TableCell from "https://esm.sh/@tiptap/extension-table-cell@2.11.7";
import TaskList from "https://esm.sh/@tiptap/extension-task-list@2.11.7";
import TaskItem from "https://esm.sh/@tiptap/extension-task-item@2.11.7";

const h = React.createElement;
const storageKey = "personal-notebook-tiptap-v1";
const blockNoteStorageKey = "personal-notebook-blocknote-v1";
const legacyStorageKey = "personal-notebook-v2";
const publishedIndexPath = "notebooks/index.json";
const localAssetPrefix = "/api/local-assets/";
const assetRootPath = "notebooks/assets";
const now = () => new Date().toISOString();

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
  networkQuery: "",
  view: "network",
  selectedTag: "",
  authenticated: false,
  pendingAuthAction: "",
  mode: "read",
  activeId: "note-welcome",
  modal: null,
  modalContext: null,
  openCreateMenu: null,
  syncStatus: "ready",
  networkRestored: true,
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
  const [state, setState] = useState(() => migrate(loadLocalState() || seed));
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadPublishedLibrary()
      .then((published) => {
        if (cancelled || !published) return;
        const local = migrate(loadLocalState() || {});
        const shouldKeepLocal = local.notes?.some((note) => note.dirty);
        if (!shouldKeepLocal) {
          setState((current) => migrate({ ...published, settings: { ...current.settings, token: current.settings.token } }));
        }
      })
      .catch((error) => console.warn("Published library load failed", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persist(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const note = currentNote(state);
  const visibleNotes = useMemo(() => filteredNotes(state), [state]);
  const tagStats = useMemo(() => filteredTagStats(state), [state]);

  const patchState = useCallback((recipe) => {
    setState((current) => {
      const next = structuredClone(current);
      recipe(next);
      return next;
    });
  }, []);

  const selectNote = (noteId) => {
    patchState((draft) => {
      draft.activeId = noteId;
      draft.mode = "read";
      draft.view = "library";
      draft.modal = null;
      draft.openCreateMenu = null;
    });
  };

  const enterTag = (tag) => {
    patchState((draft) => {
      draft.selectedTag = tag;
      draft.query = "";
      draft.view = "library";
      draft.mode = "read";
      const first = draft.notes.find((item) => !tag || (item.tags || []).includes(tag));
      if (first) draft.activeId = first.id;
    });
  };

  const updateNote = (noteId, updater) => {
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
    const name = document.querySelector("[data-modal-input='folderName']")?.value.trim() || "新文件夹";
    patchState((draft) => {
      draft.folders.push({ id: `folder-${Date.now()}`, name, parentId: draft.modalContext?.folderId || null });
      draft.modal = null;
      draft.modalContext = null;
    });
    setToast("文件夹已创建");
  };

  const createNote = () => {
    const title = document.querySelector("[data-modal-input='noteTitle']")?.value.trim() || "未命名文档";
    patchState((draft) => {
      const id = `note-${Date.now()}`;
      draft.notes.unshift({
        id,
        title,
        folderId: draft.modalContext?.folderId || null,
        tags: [],
        date: now(),
        file: `notebooks/docs/${slugify(title)}.json`,
        dirty: true,
        publishedAt: "",
        assets: [],
        html: "<p></p>"
      });
      draft.activeId = id;
      draft.mode = "edit";
      draft.modal = null;
      draft.modalContext = null;
      draft.message = "新文档已保存为本地草稿";
    });
    setToast("文档已创建");
  };

  const renameFolder = () => {
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

  const deleteNote = () => {
    if (state.notes.length <= 1) {
      setToast("至少保留一篇笔记");
      return;
    }
    patchState((draft) => {
      draft.notes = draft.notes.filter((item) => item.id !== draft.activeId);
      draft.activeId = draft.notes[0]?.id || "";
      draft.mode = "read";
      draft.message = "删除已保存到本地，发表任意文档后目录会更新";
    });
    setToast("文档已移入本地草稿变更");
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
      publishCurrentNote(authSettings);
    }
  };

  const publishCurrentNote = async (overrideSettings) => {
    if (!note) return;
    const settings = {
      ...(overrideSettings || state.settings),
      branch: "main"
    };
    if (!overrideSettings && !state.authenticated) {
      patchState((draft) => {
        draft.pendingAuthAction = "publish";
        draft.modal = "auth";
      });
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
    patchState((draft) => {
      draft.syncStatus = "publishing";
      draft.message = "正在发表到 GitHub";
    });
    try {
      const publishedAt = now();
      const current = currentNote(state);
      const docPath = current.file || `notebooks/docs/${slugify(current.title)}.json`;
      const publishedAssets = await publishPendingAssets(settings, current);
      const publishedHtml = replaceLocalAssetUrls(
        normalizeHtml(current.html || blocksToHtml(current.blocks)),
        publishedAssets
      );
      const nextNotes = state.notes.map((item) => (
        item.id === current.id ? {
          ...item,
          file: docPath,
          dirty: false,
          publishedAt,
          html: publishedHtml,
          assets: publishedAssets
        } : item
      ));
      const library = buildPublishedIndex({ ...state, notes: nextNotes }, publishedAt);
      const documentData = {
        version: 1,
        id: current.id,
        title: current.title,
        folderId: current.folderId,
        path: folderPath(state, current.folderId),
        tags: current.tags || [],
        createdAt: current.createdAt || current.date || publishedAt,
        updatedAt: publishedAt,
        assets: publishedAssets.map(({ content, dataUrl, ...asset }) => asset),
        html: publishedHtml
      };

      await putGitHubFile(settings, docPath, documentData, `Publish notebook: ${current.title}`);
      await putGitHubFile(settings, publishedIndexPath, library, "Publish notebook index");

      setState((latest) => {
        const next = structuredClone(latest);
        const target = next.notes.find((item) => item.id === current.id);
        if (target) {
          target.file = docPath;
          target.dirty = false;
          target.publishedAt = publishedAt;
          target.date = publishedAt;
          target.html = publishedHtml;
          target.assets = publishedAssets.map(({ content, dataUrl, ...asset }) => asset);
        }
        next.syncStatus = "ready";
        next.message = "已发表到 GitHub 仓库";
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
    if (action === "back-network") {
      patchState((draft) => {
        draft.view = "network";
        draft.selectedTag = "";
        draft.query = "";
        draft.mode = "read";
      });
    }
    if (action === "clear-selected-tag") {
      patchState((draft) => {
        draft.selectedTag = "";
      });
    }
    if (action === "toggle-mode") {
      if (state.mode !== "edit" && !state.authenticated) {
        patchState((draft) => {
          draft.pendingAuthAction = "edit";
          draft.modal = "auth";
        });
        return;
      }
      patchState((draft) => {
        draft.mode = draft.mode === "edit" ? "read" : "edit";
      });
    }
    if (action === "publish") publishCurrentNote();
    if (action === "toggle-create-menu") {
      patchState((draft) => {
        draft.openCreateMenu = draft.openCreateMenu === targetFolderId ? null : targetFolderId;
      });
    }
    if (action === "new-folder-in-folder") {
      patchState((draft) => {
        draft.modalContext = { folderId: targetFolderId };
        draft.openCreateMenu = null;
        draft.modal = "name-folder";
      });
    }
    if (action === "new-note-in-folder") {
      patchState((draft) => {
        draft.modalContext = { folderId: targetFolderId };
        draft.openCreateMenu = null;
        draft.modal = "name-note";
      });
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
    if (action === "delete-note") deleteNote();
  };

  if (state.view === "network") {
    return h(React.Fragment, null,
      h(NetworkView, {
        state,
        tagStats,
        onSearch: (value) => patchState((draft) => {
          draft.networkQuery = value;
        }),
        onEnterTag: enterTag
      }),
      toast ? h("div", { className: "toast" }, toast) : null
    );
  }

  return h(React.Fragment, null,
    h("div", { className: "app-shell" },
      h("aside", { className: "sidebar" },
        h("div", { className: "traffic" },
          h("span", { className: "dot red" }),
          h("span", { className: "dot yellow" }),
          h("span", { className: "dot green" })
        ),
        h("div", { className: "brand" },
          h("h1", null, "Notes"),
          h("p", null, "像文档一样写，像书目录一样找。")
        ),
        h("div", { className: "search-wrap" },
          h("input", {
            className: "search",
            value: state.query,
            placeholder: "搜索笔记、标签、正文",
            onChange: (event) => patchState((draft) => {
              draft.query = event.target.value;
            })
          })
        ),
        h("div", { className: "tree" },
          renderTree(state, visibleNotes, selectNote, handleAction, patchState)
        )
      ),
      h("main", { className: "content" },
        renderTopbar(state, note, handleAction),
        h("section", { className: "paper-scroll" },
          note
            ? h(DocumentPaper, {
                key: `${note.id}-${state.mode}`,
                note,
                state,
                editable: state.mode === "edit",
                updateNote,
                patchState
              })
            : h("div", { className: "empty" }, h("div", null, h("h2", null, "还没有笔记"), h("p", null, "从左侧新建文件夹或笔记开始。")))
        )
      )
    ),
    renderModal(state, handleAction),
    toast ? h("div", { className: "toast" }, toast) : null
  );
}

function NetworkView({ state, tagStats, onSearch, onEnterTag }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const palette = ["#ffd166", "#b9f6ca", "#7cc7ff", "#c4b5fd", "#ff9aa2", "#9bf6ff", "#a0c4ff"];
    const sourceTags = tagStats.length ? tagStats : [{ name: "Notes", count: state.notes.length }];
    const nodes = sourceTags.map((tag, index) => ({
      tag,
      phase: index * 1.71,
      drift: 0.00022 + (index % 4) * 0.000052,
      color: palette[index % palette.length],
      radius: 42 + Math.min(tag.count, 8) * 3,
      x: 0,
      y: 0
    }));
    let frame = 0;
    let disposed = false;
    let startTime = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(time) {
      if (disposed) return;
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cx = width / 2;
      const cy = height * .64;
      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(cx, height * .52, 0, cx, height * .52, Math.min(width, height) * .48);
      glow.addColorStop(0, "rgba(255,255,255,.78)");
      glow.addColorStop(.55, "rgba(255,255,255,.20)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      nodes.forEach((node, index) => {
        const spread = Math.min(320, Math.max(150, width * .16));
        const centerOffset = (nodes.length - 1) / 2;
        const baseX = cx + (index - centerOffset) * spread;
        const arcLift = Math.abs(index - centerOffset) * 34;
        const baseY = cy - arcLift + Math.sin(index * 1.3) * 10;
        node.x = baseX + Math.cos(elapsed * node.drift + node.phase) * 8;
        node.y = baseY + Math.sin(elapsed * node.drift * .9 + node.phase) * 6;
      });

      ctx.save();
      ctx.strokeStyle = "rgba(124, 199, 255, .16)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      nodes
        .slice()
        .sort((a, b) => a.x - b.x)
        .forEach((node, index, sorted) => {
          if (index === 0) ctx.moveTo(node.x, node.y);
          else {
            const previous = sorted[index - 1];
            const midX = (previous.x + node.x) / 2;
            const midY = Math.min(previous.y, node.y) - 18;
            ctx.quadraticCurveTo(midX, midY, node.x, node.y);
          }
        });
      ctx.stroke();
      ctx.restore();

      nodes.forEach((node) => {
        const aura = ctx.createRadialGradient(node.x, node.y, node.radius * .24, node.x, node.y, node.radius * 2.2);
        aura.addColorStop(0, hexToRgba(node.color, .42));
        aura.addColorStop(.48, hexToRgba(node.color, .18));
        aura.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.shadowColor = hexToRgba(node.color, .52);
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,.82)";
        ctx.stroke();

        ctx.fillStyle = "rgba(29,29,31,.82)";
        ctx.font = "700 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.tag.name, node.x, node.y - 7);
        ctx.fillStyle = "rgba(118,118,128,.82)";
        ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(`${node.tag.count} 篇`, node.x, node.y + 17);
      });

      frame = requestAnimationFrame(draw);
    }

    function handleClick(event) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const sorted = [...nodes].sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y));
      const hit = sorted[0];
      if (hit && Math.hypot(x - hit.x, y - hit.y) <= hit.radius + 14) {
        onEnterTag(hit.tag.name === "Notes" ? "" : hit.tag.name);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", handleClick);
    frame = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleClick);
    };
  }, [tagStats, onEnterTag, state.notes.length]);

  return h("section", { className: "network-shell" },
    h("canvas", { id: "network-canvas", ref: canvasRef, "aria-hidden": "true" }),
    h("div", { className: "network-glass" },
      h("div", { className: "network-search" },
        h("input", {
          value: state.networkQuery || "",
          placeholder: "搜索标签、笔记标题、正文",
          onChange: (event) => onSearch(event.target.value)
        })
      )
    )
  );
}

function DocumentPaper({ note, state, editable, updateNote }) {
  return h("article", { className: `paper ${editable ? "is-editing" : ""}` },
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
      editable
        ? h("input", {
            className: "tag-input",
            value: (note.tags || []).join(", "),
            placeholder: "标签，用逗号分隔",
            onChange: (event) => updateNote(note.id, (item) => {
              item.tags = event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
            })
          })
        : (note.tags || []).map((tag) => h("span", { className: "pill", key: tag }, tag)),
      h("span", { className: `pill ${note.dirty ? "dirty" : ""}` }, note.dirty ? "本地草稿" : "已发表"),
      h("span", { className: "pill" }, formatDate(note.date))
    ),
    h("div", { className: "tiptap-shell" },
      editable
        ? h(TiptapEditor, {
            key: note.id,
            note,
            onChange: (html) => updateNote(note.id, (item) => {
              item.html = normalizeHtml(html);
            }),
            onAssetInserted: (asset, html) => updateNote(note.id, (item) => {
              const assets = Array.isArray(item.assets) ? item.assets : [];
              item.assets = [...assets.filter((candidate) => candidate.id !== asset.id), asset];
              item.html = normalizeHtml(html);
            })
          })
        : h("div", {
            className: "reader tiptap-reader",
            dangerouslySetInnerHTML: { __html: sanitizeHtml(note.html || blocksToHtml(note.blocks)) }
          })
    )
  );
}

function TiptapEditor({ note, onChange, onAssetInserted }) {
  const shellRef = useRef(null);
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingAssetKindRef = useRef("file");
  const [editor, setEditor] = useState(null);
  const [insertMenu, setInsertMenu] = useState(null);
  const [sideButton, setSideButton] = useState({ top: 72 });

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const updateSideButton = (current) => {
      window.requestAnimationFrame(() => {
        if (!current?.view || !shellRef.current) return;
        try {
          const coords = current.view.coordsAtPos(current.state.selection.from);
          const shellRect = shellRef.current.getBoundingClientRect();
          setSideButton({ top: Math.max(4, coords.top - shellRect.top - 2) });
        } catch {
          setSideButton({ top: 72 });
        }
      });
    };
    const instance = new Editor({
      element: hostRef.current,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Placeholder.configure({
          placeholder: "输入 / 插入内容",
          showOnlyCurrent: false
        }),
        Underline,
        Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noreferrer" } }),
        Highlight.configure({ multicolor: true }),
        Image,
        Video,
        FileAttachment,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({ nested: true })
      ],
      content: normalizeHtml(note.html || blocksToHtml(note.blocks)),
      editorProps: {
        attributes: { class: "feishu-editor ProseMirror" },
        handleKeyDown(view, event) {
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
      instance.destroy();
      editorRef.current = null;
      setEditor(null);
    };
  }, [note.id]);

  const run = async (command) => {
    if (!editorRef.current) return;
    if (insertMenu?.slashRange) {
      const { from, to } = insertMenu.slashRange;
      if (editorRef.current.state.doc.textBetween(from, to) === "/") {
        editorRef.current.chain().focus().deleteRange({ from, to }).run();
      }
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
    editor ? h(FeishuBubbleToolbar, { editor, shellRef, hidden: Boolean(insertMenu) }) : null,
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
    insertMenu ? h(FeishuInsertMenu, { position: insertMenu, run }) : null
  );
}

function FeishuBubbleToolbar({ editor, shellRef, hidden }) {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!editor) return undefined;
    const update = () => forceUpdate((value) => value + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);
  if (hidden || !editor || editor.state.selection.empty) return null;
  const rect = getSelectionRect();
  if (!rect || !shellRef.current) return null;
  const shellRect = shellRef.current.getBoundingClientRect();
  const left = Math.min(
    Math.max(18, rect.left + rect.width / 2 - shellRect.left),
    shellRef.current.clientWidth - 18
  );
  const top = Math.max(8, rect.top - shellRect.top - 54);
  const buttons = [
    { label: "T", command: "paragraph", title: "正文" },
    { label: "H1", command: "h1", title: "标题 1", active: editor.isActive("heading", { level: 1 }) },
    { label: "H2", command: "h2", title: "标题 2", active: editor.isActive("heading", { level: 2 }) },
    { divider: true },
    { label: "≡", command: "bulletList", title: "列表", active: editor.isActive("bulletList") },
    { divider: true },
    { label: "B", command: "bold", active: editor.isActive("bold") },
    { label: "S", command: "strike", active: editor.isActive("strike") },
    { label: "I", command: "italic", active: editor.isActive("italic") },
    { label: "U", command: "underline", active: editor.isActive("underline") },
    { label: "↗", command: "link", title: "链接", active: editor.isActive("link") },
    { label: "</>", command: "code", title: "代码", active: editor.isActive("code") },
    { label: "A", command: "highlight", title: "高亮", active: editor.isActive("highlight") },
    { divider: true },
    { label: "▦", command: "table", title: "表格" },
    { label: "☰", command: "blockquote", title: "引用", active: editor.isActive("blockquote") }
  ];
  return h("div", {
    className: "feishu-bubble",
    style: {
      left: `${left}px`,
      top: `${top}px`
    },
    onMouseDown: (event) => event.preventDefault()
  }, buttons.map((button, index) => button.divider
    ? h("span", { className: "feishu-bubble-divider", key: `divider-${index}` })
    : h("button", {
    key: `${button.command}-${index}`,
    className: button.active ? "active" : "",
    title: button.title || button.command,
    onClick: () => applyEditorCommand(editor, button.command)
  }, button.label)));
}

function FeishuInsertMenu({ position, run }) {
  const sections = [
    {
      title: "基础",
      items: [
        { icon: "H1", label: "标题 1", command: "h1" },
        { icon: "H2", label: "标题 2", command: "h2" },
        { icon: "H3", label: "标题 3", command: "h3" },
        { icon: "1.", label: "有序列表", command: "orderedList" },
        { icon: "•", label: "无序列表", command: "bulletList" },
        { icon: "✓", label: "任务", command: "taskList" },
        { icon: "{}", label: "代码块", command: "codeBlock" },
        { icon: "“”", label: "引用", command: "blockquote" },
        { icon: "—", label: "分割线", command: "divider" },
        { icon: "↗", label: "链接", command: "link" }
      ]
    },
    {
      title: "常用",
      items: [
        { icon: "✓", label: "任务", command: "taskList", color: "#4c6fff" },
        { icon: "▧", label: "图片", command: "image", color: "#ffb800" },
        { icon: "▷", label: "视频", command: "video", color: "#15b8a6" },
        { icon: "↥", label: "文件附件", command: "file", color: "#64748b" },
        { icon: "▦", label: "表格", command: "table", color: "#00b578", arrow: true },
        { icon: "▥", label: "分栏", command: "columns", color: "#6366f1", arrow: true },
        { icon: "▤", label: "高亮块", command: "highlightBlock", color: "#ff7a45" },
        { icon: "▣", label: "同步块", command: "paragraph", color: "#3b82f6" },
        { icon: "▻", label: "按钮", command: "button", color: "#5b7cfa", arrow: true },
        { icon: "fx", label: "公式", command: "codeBlock", color: "#6b7280" },
        { icon: "◇", label: "模板", command: "template", color: "#f97316", arrow: true }
      ]
    },
    {
      title: "多维表格",
      items: [
        { icon: "▦", label: "表格", command: "table", color: "#2563eb" },
        { icon: "▥", label: "看板", command: "columns", color: "#22c55e" },
        { icon: "▱", label: "甘特图", command: "paragraph", color: "#ec4899" },
        { icon: "▦", label: "画册", command: "paragraph", color: "#8b5cf6" }
      ]
    }
  ];
  return h("div", {
    className: "feishu-insert-menu",
    style: { left: `${position.left}px`, top: `${position.top}px` },
    onMouseDown: (event) => event.preventDefault()
  }, sections.map((section) => h("div", { className: "feishu-menu-section", key: section.title },
    h("div", { className: "feishu-menu-title" }, section.title),
    section.items.map((item) => h("button", { key: `${section.title}-${item.label}`, onClick: () => run(item.command) },
      h("span", { className: "feishu-menu-icon", style: { color: item.color || "#1f2329" } }, item.icon),
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
  if (command === "bulletList") chain.toggleBulletList().run();
  if (command === "orderedList") chain.toggleOrderedList().run();
  if (command === "taskList") chain.toggleTaskList().run();
  if (command === "blockquote") chain.toggleBlockquote().run();
  if (command === "codeBlock") chain.toggleCodeBlock().run();
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

function openAssetPicker({ fileInputRef, pendingAssetKindRef }, kind) {
  if (!fileInputRef?.current) return;
  pendingAssetKindRef.current = kind;
  fileInputRef.current.accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "";
  fileInputRef.current.click();
}

async function cacheNotebookAsset(note, file, requestedKind) {
  const kind = normalizeAssetKind(requestedKind, file.type);
  validateAssetFile(file, kind);
  const dataUrl = await readFileAsDataUrl(file);
  const content = dataUrlToBase64(dataUrl);
  const fileName = uniqueAssetFileName(file.name);
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
    cached,
    content: cached ? "" : content,
    dataUrl: cached ? "" : dataUrl,
    published: false
  };
}

function insertAssetNode(editor, asset) {
  if (asset.kind === "image") {
    editor.chain().focus().setImage({ src: asset.localUrl, alt: asset.name, title: asset.name }).run();
    return;
  }
  if (asset.kind === "video") {
    editor.chain().focus().insertContent({
      type: "video",
      attrs: { src: asset.localUrl, title: asset.name, controls: true }
    }).run();
    return;
  }
  editor.chain().focus().insertContent({
    type: "fileAttachment",
    attrs: {
      href: asset.localUrl,
      name: asset.name,
      size: formatBytes(asset.size)
    }
  }).run();
}

function normalizeAssetKind(kind, mimeType) {
  if (kind === "image" || kind === "video") return kind;
  if (String(mimeType || "").startsWith("image/")) return "image";
  if (String(mimeType || "").startsWith("video/")) return "video";
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

function uniqueAssetFileName(name) {
  const cleaned = String(name || "attachment").replace(/[/\\:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  const dot = cleaned.lastIndexOf(".");
  const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const ext = dot > 0 ? cleaned.slice(dot).toLowerCase() : "";
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${safeSegment(base).slice(0, 64) || "attachment"}-${stamp}-${suffix}${ext}`;
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

function renderTopbar(state, note, handleAction) {
  return h("header", { className: "topbar" },
    h("div", { className: "crumb" },
      h("span", null, state.selectedTag ? `# ${state.selectedTag}` : note ? folderPath(state, note.folderId) || "未归档" : "没有笔记"),
      h("strong", null, note ? note.title : "创建第一篇笔记"),
      h("em", null, state.message || "编辑内容会先保存在本地，点击发表后写入 GitHub")
    ),
    h("div", { className: "toolbar" },
      h("button", { className: "ghost-btn", onClick: () => handleAction("back-network") }, "知识网络"),
      note ? h("button", {
        className: `ghost-btn ${state.mode === "edit" ? "active" : ""}`,
        onClick: () => handleAction("toggle-mode")
      }, state.mode === "edit" ? "阅读" : "编辑") : null,
      note ? h("button", {
        className: "primary-btn",
        disabled: state.syncStatus === "publishing",
        onClick: () => handleAction("publish")
      }, state.syncStatus === "publishing" ? "发表中" : "发表") : null,
      note ? h("button", { className: "danger-btn", onClick: () => handleAction("delete-note") }, "删除") : null
    )
  );
}

function renderTree(state, visibleNotes, selectNote, handleAction, patchState) {
  const rootFolders = state.folders.filter((folder) => !folder.parentId);
  const orphanNotes = visibleNotes.filter((note) => !note.folderId);
  const children = [
    ...rootFolders.map((folder) => renderFolder(state, folder, 0, visibleNotes, selectNote, handleAction, patchState)),
    ...orphanNotes.map((note) => renderNoteItem(state, note, 0, selectNote, patchState))
  ];
  if (!visibleNotes.length) {
    children.push(h("div", { className: "empty", key: "empty" }, h("div", null, h("strong", null, "没有找到笔记"), h("p", null, "换个关键词试试。"))));
  }
  return children;
}

function renderFolder(state, folder, depth, visibleNotes, selectNote, handleAction, patchState) {
  const children = state.folders.filter((item) => item.parentId === folder.id);
  const notes = visibleNotes.filter((note) => note.folderId === folder.id);
  const count = countNotes(state, folder.id, visibleNotes);
  if (state.query.trim() && count === 0) return null;
  return h("div", { className: "tree-section", key: folder.id },
    h("button", {
      className: `tree-folder indent-${Math.min(depth, 3)}`,
      onDoubleClick: () => patchState((draft) => {
        draft.modalContext = { folderId: folder.id };
        draft.openCreateMenu = null;
        draft.modal = "rename-folder";
      })
    },
      h("span", null, "▾"),
      h("strong", null, folder.name),
      h("span", {
        className: "mini-action",
        title: "新建",
        onClick: (event) => {
          event.stopPropagation();
          handleAction("toggle-create-menu", folder.id);
        }
      }, "+")
    ),
    state.openCreateMenu === folder.id
      ? h("div", { className: "create-menu" },
          h("button", { onClick: () => handleAction("new-folder-in-folder", folder.id) }, "文件夹"),
          h("button", { onClick: () => handleAction("new-note-in-folder", folder.id) }, "文档")
        )
      : null,
    notes.map((note) => renderNoteItem(state, note, depth + 1, selectNote, patchState)),
    children.map((child) => renderFolder(state, child, depth + 1, visibleNotes, selectNote, handleAction, patchState))
  );
}

function renderNoteItem(state, note, depth, selectNote, patchState) {
  return h("button", {
    className: `tree-note indent-${Math.min(depth, 3)} ${note.id === state.activeId ? "active" : ""}`,
    key: note.id,
    onClick: () => selectNote(note.id),
    onDoubleClick: () => patchState((draft) => {
      draft.modalContext = { noteId: note.id };
      draft.openCreateMenu = null;
      draft.modal = "rename-note";
    })
  },
    h("span", null, note.dirty ? "●" : "◦"),
    h("strong", null, note.title || "未命名笔记")
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
      h("div", { className: "field" }, h("label", null, "文档标题"), h("input", { "data-modal-input": "noteTitle", placeholder: "例如 Vue 组件通信" })),
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

function modalShell(title, text, body, confirmText, action, handleAction) {
  return h("div", { className: "modal-backdrop" },
    h("div", { className: "modal" },
      h("h2", null, title),
      h("p", null, text),
      h("div", { className: "form" }, body),
      h("div", { className: "modal-actions" },
        h("button", { className: "ghost-btn", onClick: () => handleAction("close-modal") }, "取消"),
        h("button", { className: "primary-btn", onClick: () => handleAction(action) }, confirmText)
      )
    )
  );
}

async function loadPublishedLibrary() {
  const response = await fetch(`${publishedIndexPath}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return null;
  const index = await response.json();
  const docs = await Promise.all((index.docs || []).map(async (doc) => {
    const docResponse = await fetch(`${trimSlash(doc.file)}?v=${Date.now()}`, { cache: "no-store" });
    if (!docResponse.ok) return null;
    const documentData = await docResponse.json();
    return {
      id: documentData.id || doc.id,
      title: documentData.title || doc.title,
      folderId: doc.folderId || documentData.folderId || null,
      tags: documentData.tags || doc.tags || [],
      date: documentData.updatedAt || doc.updatedAt || now(),
      file: doc.file,
      dirty: false,
      publishedAt: documentData.updatedAt || doc.updatedAt || "",
      assets: documentData.assets || [],
      html: normalizeHtml(documentData.html || blocksToHtml(documentData.blocks))
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
      tags: note.tags || [],
      updatedAt: note.date || updatedAt,
      file: note.file || `notebooks/docs/${slugify(note.title)}.json`
    }))
  };
}

async function putGitHubFile(settings, path, data, message) {
  return putGitHubBase64File(settings, path, encodeBase64Utf8(JSON.stringify(data, null, 2)), message);
}

async function putGitHubBase64File(settings, path, content, message) {
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
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(detail?.message || `GitHub 写入失败：${response.status}`);
  }
  return response.json();
}

async function publishPendingAssets(settings, note) {
  const assets = Array.isArray(note.assets) ? note.assets : [];
  const html = normalizeHtml(note.html || blocksToHtml(note.blocks));
  const referenced = assets.filter((asset) => asset.localUrl && html.includes(asset.localUrl));
  const published = [];
  for (const asset of referenced) {
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
  return [
    ...assets.filter((asset) => !referenced.some((item) => item.id === asset.id)),
    ...published
  ];
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
  const response = await fetch(`${githubContentUrl(settings, path)}?ref=${encodeURIComponent(settings.branch)}`, {
    headers: githubHeaders(settings.token)
  });
  if (response.status === 404) return "";
  if (!response.ok) {
    const detail = await safeJson(response);
    throw new Error(detail?.message || `GitHub 读取失败：${response.status}`);
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

function persist(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function migrate(data) {
  const shouldRestoreNetwork = data.networkRestored !== true;
  const merged = {
    ...seed,
    ...data,
    settings: { ...seed.settings, ...(data.settings || {}) },
    folders: data.folders?.length ? data.folders : structuredClone(seed.folders),
    notes: data.notes?.length ? data.notes : structuredClone(seed.notes)
  };
  merged.notes = merged.notes.map((note) => ({
    id: note.id || `note-${Date.now()}`,
    title: note.title || "未命名文档",
    folderId: note.folderId || null,
    tags: note.tags || [],
    date: note.date || note.updatedAt || now(),
    file: note.file || `notebooks/docs/${slugify(note.title || "untitled")}.json`,
    dirty: Boolean(note.dirty),
    publishedAt: note.publishedAt || "",
    assets: Array.isArray(note.assets) ? note.assets : [],
    html: normalizeHtml(note.html || blocksToHtml(note.blocks))
  }));
  if (!merged.notes.some((note) => note.id === merged.activeId)) merged.activeId = merged.notes[0]?.id || "";
  if (shouldRestoreNetwork) {
    merged.view = "network";
    merged.selectedTag = "";
    merged.query = "";
  }
  merged.networkQuery = merged.networkQuery || "";
  merged.networkRestored = true;
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
      tags: note.tags || [],
      date: note.date || now(),
      file: `notebooks/docs/${slugify(note.title || note.id)}.json`,
      dirty: true,
      publishedAt: "",
      assets: [],
      html: normalizeHtml(note.html || "")
    }))
  };
}

function currentNote(state) {
  return state.notes.find((item) => item.id === state.activeId) || state.notes[0] || null;
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

function filteredTagStats(state) {
  const query = (state.networkQuery || "").trim().toLowerCase();
  const matchedNotes = query
    ? state.notes.filter((note) => {
        const text = `${note.title} ${folderPath(state, note.folderId)} ${(note.tags || []).join(" ")} ${htmlToText(note.html || blocksToHtml(note.blocks))}`.toLowerCase();
        return text.includes(query);
      })
    : state.notes;
  const counts = new Map();
  matchedNotes.forEach((note) => {
    (note.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  if (query) {
    state.notes.forEach((note) => {
      (note.tags || [])
        .filter((tag) => tag.toLowerCase().includes(query))
        .forEach((tag) => counts.set(tag, Math.max(counts.get(tag) || 0, 1)));
    });
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hans-CN"));
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
  return sanitizeHtml(html || "<p></p>");
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
