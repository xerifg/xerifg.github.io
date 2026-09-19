// Served only by workspace-fixture-server.py, never imported by the production app.
import { wikiPages, fixtureGraph } from '/tests/workspace-wiki-data.mjs';
export const serviceURL = () => "https://fixture.invalid";
export const notifyCloudSession = () => {};
export function cloudClient() {
  return {
    base: "https://fixture.invalid", token: () => "fixture-only", logout: async () => {},
    async request(path, options = {}) {
      if (path === "/api/account") return { username: "验收沙盒", repository: { owner: "fixture", repo: "fixture", branch: "main" } };
      if (path === "/api/status") return { generation: "fixture", wikiCount: wikiPages.length };
      if (path === "/api/wiki") return wikiPages;
      if (path.startsWith('/api/wiki/page?')) {
        const slug=new URLSearchParams(path.split('?')[1]).get('slug');
        const page=wikiPages.find(p=>p.slug===slug);
        return {...page,generatedContent:page.content,generatedRefs:[]};
      }
      if (path.startsWith('/api/graph?')) {
        const params=new URLSearchParams(path.split('?')[1]);
        return fixtureGraph(params.get('center'),Number(params.get('depth')));
      }
      if (path === "/api/conversations") return [];
      if (path === "/api/prepare") return { conversationId: "fixture", answer: "可对照 WA-JEPA 的学习记录。[1]", sources: [{ noteId: "demo-wa", title: "WA-JEPA", text: "这里记录了与 V-JEPA 的比较思路。", headingIndex: 0 }] };
      if (path.startsWith("/api/repository?")) {
        const response = await fetch(path.replace("/api/repository?", "/fixture/repository?"), { method: options.method || "GET", headers: { "Content-Type": "application/json" }, body: options.data ? JSON.stringify(options.data) : undefined });
        return options.raw ? response : response.json();
      }
      throw new Error(`未模拟的接口：${path}`);
    }
  };
}
