import { readSSE } from "../cloud/src/core.mjs";

export function notifyCloudSession(base) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("notebook-cloud-session", { detail: { base } }));
}

export async function passwordProof(password, salt, iterations = 600000) {
  if (!/^[a-f0-9]{32}$/.test(salt) || iterations !== 600000) throw new Error("登录服务配置不正确");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bytes = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt.match(/../g), (v) => parseInt(v, 16)), iterations }, key, 256);
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function serviceURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "";
    return url.origin;
  } catch { return ""; }
}

export function cloudClient(value) {
  const base = serviceURL(value);
  const key = `notebook-cloud-session:${base}`;
  const token = () => sessionStorage.getItem(key) || "";
  async function request(path, { data, signal, method = data === undefined ? "GET" : "POST", stream = false, raw = false } = {}) {
    if (!base) throw new Error("请在 AI 设置中填写有效的云端地址（HTTPS）");
    const response = await fetch(base + path, {
      method, signal, headers: { Authorization: `Bearer ${token()}`, ...(data === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    if (response.status === 401) { sessionStorage.removeItem(key); notifyCloudSession(base); }
    if (raw && (response.ok || [404, 409, 422].includes(response.status))) return response;
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `云端请求失败（${response.status}）`);
    }
    return stream ? response : response.json();
  }
  return {
    base, token, request,
    async login(username, password) {
      const config = await request("/auth/config");
      const proof = await passwordProof(password, config.salt, config.iterations);
      const result = await request("/auth/login", { data: { username: username.trim(), proof } });
      if (!/^[a-f0-9-]{72}$/.test(result.token || "")) throw new Error("登录响应不正确");
      sessionStorage.setItem(key, result.token);
      notifyCloudSession(base);
      return result;
    },
    async logout() { try { await request("/api/logout", { data: {} }); } finally { sessionStorage.removeItem(key); notifyCloudSession(base); } },
    async answer(ticket, onDelta, signal) {
      const response = await request("/api/answer", { data: { ticket }, stream: true, signal });
      let complete = false; let content = "";
      await readSSE(response.body, (event) => {
        if (event.error) throw new Error("模型回答中断，请重试");
        const choice = event.choices?.[0];
        if (choice?.delta?.content) { content += choice.delta.content; if (content.length > 30000) throw new Error("回答超出长度限制"); onDelta(choice.delta.content); }
        if (choice?.finish_reason) complete = true;
      });
      if (!complete) throw new Error("回答连接已中断，未保存到历史记录");
      try { await request("/api/complete", { data: { ticket, content }, signal }); }
      catch (error) { throw new Error(`回答已接收但未保存：${error.message}`); }
    }
  };
}
