import Image from "https://esm.sh/@tiptap/extension-image@2.11.7";
import { NodeSelection, Plugin, TextSelection } from "https://esm.sh/@tiptap/pm@2.11.7/state";
import { closeHistory } from "https://esm.sh/@tiptap/pm@2.11.7/history";
import { GapCursor } from "https://esm.sh/@tiptap/pm@2.11.7/gapcursor";

function imageWidth(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/);
  return match && Number(match[1]) > 0 ? Math.round(Number(match[1])) : null;
}

export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => imageWidth(element.getAttribute("width")) || imageWidth(element.style.width),
        renderHTML: attributes => imageWidth(attributes.width) ? { width: imageWidth(attributes.width) } : {}
      }
    };
  },

  addProseMirrorPlugins() {
    return [...(this.parent?.() || []), new Plugin({
      view(view) {
        const clearSelection = event => {
          const { selection, doc } = view.state;
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") return;
          if (event.type === "keydown" && event.key !== "Escape") return;
          if (event.type === "pointerdown" && view.nodeDOM(selection.from)?.contains(event.target)) return;
          const after = doc.resolve(selection.to);
          const next = TextSelection.findFrom(after, 1, true)
            || TextSelection.findFrom(doc.resolve(selection.from), -1, true);
          if (next) view.dispatch(view.state.tr.setSelection(next));
          else if (GapCursor.valid(after)) view.dispatch(view.state.tr.setSelection(new GapCursor(after)));
        };
        const owner = view.dom.ownerDocument;
        owner.addEventListener("pointerdown", clearSelection);
        owner.addEventListener("keydown", clearSelection);
        return { destroy() {
          owner.removeEventListener("pointerdown", clearSelection);
          owner.removeEventListener("keydown", clearSelection);
        } };
      }
    })];
  },

  addNodeView() {
    return ({ node, editor, getPos, HTMLAttributes }) => {
      const dom = document.createElement("div");
      dom.className = "note-image";
      dom.contentEditable = "false";
      const img = document.createElement("img");
      img.draggable = false;
      for (const [name, value] of Object.entries(HTMLAttributes)) {
        if (value != null) img.setAttribute(name, value);
      }
      dom.append(img);
      let current = node;
      let cancelResize = null;
      const sync = () => {
        for (const name of ["src", "alt", "title", "width"]) {
          if (current.attrs[name] == null) img.removeAttribute(name);
          else img.setAttribute(name, current.attrs[name]);
        }
        dom.style.width = current.attrs.width ? `${current.attrs.width}px` : "fit-content";
      };
      const select = () => {
        const pos = getPos();
        if (typeof pos !== "number") return;
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
        dom.classList.add("is-selected");
        editor.view.focus();
      };
      const maxWidth = () => {
        const parent = dom.parentElement;
        const style = getComputedStyle(parent);
        return parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      };
      const commit = width => {
        const pos = getPos();
        if (typeof pos !== "number" || editor.state.doc.nodeAt(pos)?.type !== current.type) return;
        editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, { ...current.attrs, width }));
        editor.view.dispatch(closeHistory(editor.state.tr));
      };
      dom.addEventListener("pointerdown", event => {
        if (event.button !== 0 || !editor.isEditable) return;
        event.preventDefault();
        select();
        const handle = event.target.closest(".note-image-handle");
        if (!handle) return;
        cancelResize?.();
        const rect = img.getBoundingClientRect();
        const ratio = rect.width / rect.height;
        if (!Number.isFinite(ratio) || ratio <= 0) return;
        const limit = maxWidth();
        const startX = event.clientX, startY = event.clientY;
        const sx = handle.dataset.corner.includes("w") ? -1 : 1;
        const sy = handle.dataset.corner.includes("n") ? -1 : 1;
        let width = rect.width;
        let moved = false;
        const move = next => {
          if (next.pointerId !== event.pointerId) return;
          const dx = (next.clientX - startX) * sx;
          const dy = (next.clientY - startY) * sy;
          if (!moved && Math.hypot(dx, dy) < 3) return;
          moved = true;
          const delta = (dx + dy / ratio) / (1 + 1 / (ratio * ratio));
          width = Math.round(Math.min(limit, Math.max(Math.min(48, limit), rect.width + delta)));
          dom.style.width = `${width}px`;
          img.setAttribute("width", width);
        };
        const cleanup = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", finish);
          handle.removeEventListener("pointercancel", cancel);
          handle.removeEventListener("lostpointercapture", cancel);
          document.removeEventListener("keydown", escape, true);
          if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
          dom.classList.remove("is-resizing");
          cancelResize = null;
        };
        const cancel = () => { cleanup(); sync(); };
        const finish = next => {
          if (next.pointerId !== event.pointerId) return;
          move(next);
          cleanup();
          if (moved && width !== Math.round(rect.width)) commit(width);
          else sync();
        };
        const escape = next => { if (next.key === "Escape") cancel(); };
        cancelResize = cancel;
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", finish);
        handle.addEventListener("pointercancel", cancel);
        handle.addEventListener("lostpointercapture", cancel);
        document.addEventListener("keydown", escape, true);
        dom.classList.add("is-resizing");
        handle.setPointerCapture(event.pointerId);
      });
      for (const corner of ["nw", "ne", "sw", "se"]) {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "note-image-handle";
        handle.dataset.corner = corner;
        handle.setAttribute("aria-label", `调整图片尺寸（${{ nw: "左上", ne: "右上", sw: "左下", se: "右下" }[corner]}）`);
        handle.title = "拖动等比例缩放，方向键调整尺寸";
        handle.addEventListener("keydown", event => {
          if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          const delta = ["ArrowLeft", "ArrowDown"].includes(event.key) ? -10 : 10;
          const limit = maxWidth();
          commit(Math.round(Math.min(limit, Math.max(Math.min(48, limit), img.getBoundingClientRect().width + delta))));
        });
        dom.append(handle);
      }
      sync();
      return {
        dom,
        update(next) {
          if (next.type !== current.type) return false;
          cancelResize?.();
          current = next;
          sync();
          return true;
        },
        selectNode() { dom.classList.add("is-selected"); },
        deselectNode() { dom.classList.remove("is-selected"); },
        stopEvent: event => event.target.closest?.(".note-image-handle") || ["pointerdown", "mousedown", "click", "dblclick", "dragstart"].includes(event.type),
        ignoreMutation: mutation => mutation.type !== "selection",
        destroy() { cancelResize?.(); }
      };
    };
  }
});
