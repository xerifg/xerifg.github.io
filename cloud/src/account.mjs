const json = (data, status = 200) => Response.json(data, { status });
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
const now = () => Math.floor(Date.now() / 1000);
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function account(env) {
  let value;
  try { value = JSON.parse(env.OWNER_AUTH); } catch { /* Report a configuration error without secrets. */ }
  if (!value || typeof value.username !== "string" || !/^[a-f0-9]{32}$/.test(value.salt) || !/^[a-f0-9]{64}$/.test(value.verifier)) fail("尚未配置自定义账号，请先完成云端部署", 503);
  return value;
}

// Changing credentials invalidates existing sessions, including legacy OAuth sessions.
export const sessionId = (env, token) => hash(`${account(env).username}:${account(env).verifier}:${token}`);

export async function accountRoute(request, env, url, bodyJSON) {
  const config = account(env);
  if (url.pathname === "/auth/config" && request.method === "GET") return json({ salt: config.salt, iterations: 600000 });
  if (url.pathname !== "/auth/login" || request.method !== "POST") return json({ error: "接口不存在" }, 404);
  const input = await bodyJSON(request, 2048);
  const bucket = Math.floor(now() / 900);
  const ip = await hash(request.headers.get("CF-Connecting-IP") || "unknown");
  // Reserve attempts atomically before verification. The global budget also bounds D1 growth.
  for (const [key, limit] of [["global", 50], [ip, 5]]) {
    const reserved = await env.DB.prepare("INSERT INTO login_attempts(id,bucket,attempts) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET bucket=excluded.bucket,attempts=CASE WHEN bucket=excluded.bucket THEN attempts+1 ELSE 1 END WHERE bucket<>excluded.bucket OR attempts<? RETURNING id").bind(key, bucket, limit).first();
    if (!reserved) fail("登录尝试过多，请在 15 分钟后重试", 429);
  }
  const proof = typeof input.proof === "string" && /^[a-f0-9]{64}$/.test(input.proof) ? input.proof : "";
  const actual = await hash(proof);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ config.verifier.charCodeAt(i);
  if (difference || input.username !== config.username || !proof) fail("账号或密码不正确", 401);
  const token = crypto.randomUUID() + crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO auth_sessions(id,expires) VALUES (?,?)").bind(await sessionId(env, token), now() + 7 * 86400),
    env.DB.prepare("DELETE FROM auth_sessions WHERE expires<?").bind(now()),
    env.DB.prepare("DELETE FROM login_attempts WHERE bucket<?").bind(bucket),
    env.DB.prepare("DELETE FROM answer_tickets WHERE expires<?").bind(now())
  ]);
  return json({ token, username: config.username });
}

export function repositorySettings(env) {
  return { owner: env.GITHUB_OWNER, repo: env.NOTEBOOK_REPO, branch: "main" };
}

export async function repositoryRoute(request, env, url, bodyJSON) {
  if (!env.GITHUB_PUBLISH_TOKEN || !/^[\w.-]+$/.test(env.GITHUB_OWNER || "") || !/^[\w.-]+$/.test(env.NOTEBOOK_REPO || "")) fail("尚未配置云端发布凭据", 503);
  const path = url.searchParams.get("path") || "";
  const segments = path.split("/");
  if (path.length > 500 || segments.some((p) => !p || p === "." || p === ".." || /[\\%\x00-\x1f\x7f]/.test(p)) ||
      !(path === "notebooks/index.json" || path === "notebooks/favorites.json" || /^notebooks\/docs\/.+\.json$/.test(path) || /^notebooks\/assets\/.+/.test(path))) fail("不允许访问此仓库路径", 403);
  if (!["GET", "PUT", "DELETE"].includes(request.method)) fail("不支持此操作", 405);
  let payload;
  if (request.method !== "GET") {
    const input = await bodyJSON(request, 8 * 1024 * 1024);
    if (input.sha !== undefined && !/^[a-f0-9]{40}$/.test(input.sha)) fail("文件版本不正确", 400);
    if (request.method === "DELETE" && !input.sha) fail("删除时必须提供文件版本", 400);
    if (request.method === "PUT" && (typeof input.content !== "string" || input.content.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 || input.content.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.content))) fail("文件内容格式不正确或超过 5 MB 云端大小限制", 400);
    payload = { message: typeof input.message === "string" ? input.message.slice(0, 200) : "Update notebook", branch: "main",
      ...(input.sha ? { sha: input.sha } : {}), ...(request.method === "PUT" ? { content: input.content } : {}) };
  }
  const target = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.NOTEBOOK_REPO}/contents/${segments.map(encodeURIComponent).join("/")}${request.method === "GET" ? "?ref=main" : ""}`;
  // Workers supports manual redirects; reject non-OK responses below without forwarding credentials.
  const response = await fetch(target, { method: request.method, redirect: "manual", signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${env.GITHUB_PUBLISH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "personal-notebook", "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}) });
  if (!response.ok) {
    await response.body?.cancel();
    const status = [404, 409, 422].includes(response.status) ? response.status : 502;
    const message = status === 404 ? "仓库文件不存在或发布凭据无权访问" : status === 409 || status === 422 ? "GitHub 文件版本冲突，请重新审阅后发布" : "GitHub 发布服务不可用，请检查服务端令牌及权限";
    return json({ message, error: message }, status);
  }
  return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
}
