import { Node } from "https://esm.sh/@tiptap/core@2.11.7";
import { NodeSelection } from "https://esm.sh/@tiptap/pm@2.11.7/state";
import { normalizeBoard, createBoard, boardPreviewHTML, escapeBoardHTML } from "./whiteboard-model.mjs";

function blockHTML(board) {
  return `<div class="wb-block-header"><strong>${escapeBoardHTML(board.title)}</strong><button type="button" class="wb-view">展开查看 ↗</button></div>${boardPreviewHTML(board)}`;
}
export const WhiteboardNode = Node.create({
  name: "whiteboard", group: "block", atom: true, selectable: true, isolating: true,
  addOptions() { return { getNotes: () => [], onImage: null, onAssetInserted: null, onOpenNote: null }; },
  addAttributes() {
    return { board: { default: null, rendered: false, parseHTML: el => normalizeBoard(el.getAttribute("data-whiteboard")) } };
  },
  parseHTML() { return [{ tag: 'div[data-type="whiteboard"]' }]; },
  renderHTML({ node }) {
    const board = normalizeBoard(node.attrs.board), dom = document.createElement("div");
    dom.className = "whiteboard-block"; dom.dataset.type = "whiteboard";
    dom.setAttribute("data-whiteboard",JSON.stringify(board));
    dom.innerHTML = blockHTML(board);
    return dom;
  },
  addCommands() {
    return { insertWhiteboard: () => ({ editor, commands }) => {
      const board = createBoard();
      const result = commands.insertContent([{ type:"whiteboard",attrs:{board} },{ type:"paragraph" }]);
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) editor.view.dom.querySelector(`[data-board-id="${board.id}"]`)?.dispatchEvent(new Event("whiteboard-open"));
      });
      return result;
    } };
  },
  addNodeView() {
    const options = this.options;
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "whiteboard-block"; dom.contentEditable = "false"; dom.tabIndex = 0;
      let current = node, close = null, disposed = false, opening = false;
      let assets = [];
      const render = () => {
        const board = normalizeBoard(current.attrs.board);
        dom.dataset.boardId = board.id;
        dom.innerHTML = `${blockHTML(board)}<div class="wb-block-actions"><button type="button" class="wb-edit">编辑白板</button><button type="button" class="wb-delete">删除白板</button></div>`;
      };
      const open = async (readOnly = false) => {
        if (disposed || close || opening) return;
        opening = true;
        try {
          const { openWhiteboard } = await import("./whiteboard-ui.mjs?v=20260919-whiteboard-v8");
          if (disposed) return;
          close = openWhiteboard({ board:current.attrs.board,notes:options.getNotes(),readOnly,
            onImage:async file => { const asset = await options.onImage(file); assets.push(asset); return asset; },
            onChange:board => {
              const pos = getPos();
              if (disposed || typeof pos !== "number") return;
              editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{board:normalizeBoard(board)}).setMeta("whiteboard-change",true));
              for (const asset of assets) options.onAssetInserted?.(asset,editor.getHTML());
              assets = [];
            },
            onOpenNote:options.onOpenNote,onClose:()=>{close=null;}
          });
        } catch (error) { window.alert(`白板打开失败：${error.message}`); }
        finally { opening = false; }
      };
      dom.addEventListener("whiteboard-open",()=>open());
      dom.addEventListener("click",event => {
        event.preventDefault();
        const pos = getPos();
        if (event.target.closest(".wb-edit")) return open();
        if (event.target.closest(".wb-view")) return open(true);
        if (typeof pos !== "number") return;
        if (event.target.closest(".wb-delete")) return editor.view.dispatch(editor.state.tr.delete(pos,pos+current.nodeSize).setMeta("whiteboard-change",true));
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc,pos)));
        editor.view.focus();
      });
      dom.addEventListener("dblclick",event=>{event.preventDefault();open();});
      dom.addEventListener("keydown",event=>{if(event.key==="Enter" && event.target===dom){event.preventDefault();open();}});
      render();
      return { dom,
        update(next) { if(next.type!==current.type)return false;current=next;render();return true; },
        selectNode(){dom.classList.add("is-selected");},deselectNode(){dom.classList.remove("is-selected");},
        stopEvent:()=>true,ignoreMutation:()=>true,
        destroy(){disposed=true;close?.();}
      };
    };
  }
});

export function enhanceWhiteboards(root, { notes, onOpenNote }) {
  let close = null, disposed = false, opening = false;
  const click = async event => {
    const block = event.target.closest('[data-type="whiteboard"]');
    if (!block || !root.contains(block) || event.target.closest('a[href^="#note/"]')) return;
    event.preventDefault(); event.stopPropagation();
    if (close || opening) return;
    opening = true;
    try {
      const { openWhiteboard } = await import("./whiteboard-ui.mjs?v=20260919-whiteboard-v8");
      if (!disposed) close = openWhiteboard({ board:normalizeBoard(block.getAttribute("data-whiteboard")),notes,readOnly:true,onOpenNote,onClose:()=>{close=null;} });
    } catch (error) { window.alert(`白板打开失败：${error.message}`); }
    finally { opening=false; }
  };
  root.addEventListener("click",click);
  return () => {disposed=true;close?.();root.removeEventListener("click",click);};
}
