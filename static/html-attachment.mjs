function htmlAttachmentLink(card) {
  const link = card.querySelector("a[href]");
  if (!link) return null;
  const name = link.getAttribute("download") || link.textContent.trim();
  const href = link.getAttribute("href");
  if (!/\.html?$/i.test(name) && !/\.html?(?:[?#]|$)/i.test(href)) return null;
  const url = new URL(href, document.baseURI);
  return ["http:", "https:", "blob:", "data:"].includes(url.protocol) ? link : null;
}

export function enhanceHtmlAttachments(root) {
  const cleanups = [...root.querySelectorAll('[data-type="file-attachment"]')].map(card => {
    const link = htmlAttachmentLink(card);
    if (!link) return () => {};
    let panel = null;
    let controller = null;
    link.setAttribute("aria-expanded", "false");
    link.title = "点击预览 HTML";
    const close = () => {
      controller?.abort();
      controller = null;
      panel?.remove();
      panel = null;
      link.setAttribute("aria-expanded", "false");
    };
    const toggle = async event => {
      event.preventDefault();
      event.stopPropagation();
      if (panel) { close(); return; }
      const request = new AbortController();
      controller = request;
      panel = document.createElement("div");
      panel.className = "html-attachment-preview";
      panel.contentEditable = "false";
      const toolbar = document.createElement("div");
      toolbar.className = "html-attachment-toolbar";
      const download = link.cloneNode(true);
      download.removeAttribute("aria-expanded");
      download.removeAttribute("class");
      download.title = "下载原文件";
      download.textContent = "下载";
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.textContent = "收起预览";
      collapse.addEventListener("click", () => { close(); link.focus(); });
      toolbar.append(download, collapse);
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      status.textContent = "正在加载 HTML 预览…";
      panel.append(toolbar, status);
      card.append(panel);
      link.setAttribute("aria-expanded", "true");
      try {
        const url = new URL(link.getAttribute("href"), document.baseURI);
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) throw new Error("load failed");
        const source = await response.text();
        if (request.signal.aborted) return;
        const content = new DOMParser().parseFromString(source, "text/html");
        if (!content.querySelector("base[href]")) {
          const base = content.createElement("base");
          base.href = response.url || url.href;
          content.head.prepend(base);
        }
        const frame = document.createElement("iframe");
        frame.title = `HTML 预览：${link.getAttribute("download") || link.textContent}`;
        // Scripts can run, but cannot access the notebook's origin or storage.
        frame.setAttribute("sandbox", "allow-scripts");
        frame.referrerPolicy = "no-referrer";
        frame.srcdoc = `<!doctype html>\n${content.documentElement.outerHTML}`;
        status.replaceWith(frame);
      } catch (error) {
        if (!request.signal.aborted) status.textContent = "HTML 预览加载失败，请收起后重试，或下载原文件。";
      }
    };
    link.addEventListener("click", toggle);
    return () => {
      close();
      link.removeEventListener("click", toggle);
      link.removeAttribute("aria-expanded");
      link.removeAttribute("title");
    };
  });
  return () => cleanups.forEach(cleanup => cleanup());
}
