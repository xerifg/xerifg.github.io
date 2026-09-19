// Served only by workspace-fixture-server.py, never imported by the production app.
export const serviceURL = () => "https://fixture.invalid";
export const notifyCloudSession = () => {};
export function cloudClient() {
  return {
    base: "https://fixture.invalid", token: () => "fixture-only", logout: async () => {},
    async request(path, options = {}) {
      if (path === "/api/account") return { username: "验收沙盒", repository: { owner: "fixture", repo: "fixture", branch: "main" } };
      if (path === "/api/status") return { generation: "fixture", wikiCount: 0 };
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
