# 云端问答与知识 Wiki

现有 GitHub Pages 笔记站继续作为前端。Cloudflare Workers Free 负责自定义账号登录、笔记发布、检索和模型转发，D1 保存片段、Wiki 与历史记录，Vectorize 保存向量。GitHub Actions 的标准 Linux runner 解析已发布笔记并生成 Wiki，不需要购买服务器或在个人电脑运行后端。模型 API 按供应商计费。

## 首次上线

先将本次代码提交并推送到 `main`。以下配置均在网页完成，不需要本地安装部署工具。

1. **Cloudflare**：创建或使用免费账户，在 Workers & Pages 中启用自己的 `workers.dev` 子域。保留 **Workers Free**，无需开通 Workers Paid、R2、Queues 或付费域名。
2. 在 Cloudflare 账户首页记下 Account ID。创建 API Token，范围限制为你的账户，赋予 **Workers Scripts: Edit、D1: Edit、Vectorize: Edit、Account Settings: Read**。这些权限供 GitHub Actions 创建资源与发布服务。
3. **自定义账号与发布令牌**：准备你自己的账号名，以及 12～256 字符的独立密码（建议使用密码管理器生成，不是 GitHub 密码）。在 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建令牌，仅选择当前笔记仓库，Repository permissions 中授予 **Contents: Read and write**；不需要 Workflows 权限。该令牌只交给后端用于发布。无需创建 OAuth App。
4. **模型账户**：默认回答和 Wiki 整理由 DeepSeek `deepseek-chat` 完成；向量和重排使用 SiliconFlow 的 Qwen3 系列。准备两个供应商的 API Key。已有兼容服务也可通过下表中的 Variables 替换。账户与 API 域名需对应中国站或国际站。
5. 在本仓库 Settings → Secrets and variables → Actions → **Secrets** 中添加下表。密钥不得写入代码、浏览器设置或聊天。

| Secret 名称 | 内容 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | 上面创建的 Token |
| `CHAT_API_KEY` | DeepSeek API Key |
| `EMBEDDING_API_KEY` | SiliconFlow API Key |
| `RERANK_API_KEY` | 可选；不填则复用 SiliconFlow Key |
| `OWNER_USERNAME` | 自定义笔记账号名，1～80 字符 |
| `OWNER_PASSWORD` | 自定义笔记密码，12～256 字符 |
| `NOTEBOOK_GITHUB_TOKEN` | 上面创建的仅当前仓库 Contents 读写权限的长期令牌 |

6. 仓库必须保持 **public**，以使用公共仓库的免费标准 runner。Pages 保持从 `main` 的根目录发布。允许工作流写入仓库；流程仅写入公开服务地址和由公开笔记生成的 Wiki 快照。
7. 在 Actions → **Knowledge Cloud** → Run workflow，选 `deploy-and-sync`。流程会自动创建 `notebook-knowledge` 数据库和 `notebook-chunks` 索引、初始化表、部署 API、上传密钥并编译笔记。无需手填 D1 ID。部署摘要会显示服务地址。
8. 首次构建可能耗时数十分钟并调用收费模型。默认一次最多 350 次模型请求；如果触及预算保护，已完成的结果会缓存，重新运行 `sync` 可继续。
9. 成功后打开笔记站，AI 设置会自动读取公开的 `static/cloud-config.json`；也可以手填摘要中的 HTTPS 服务地址。点击编辑、AI 助手、知识 Wiki 或设置中的 **账号登录**，输入自定义账号和密码。一次登录即可使用发布、问答和 Wiki。
10. 验收通过后，在 Actions → **Variables** 添加 `CLOUD_ENABLED=true`。以后发布或删除笔记会自动更新索引。未开启此开关时不会因推送代码自动花费模型费用，仍可手动运行。

部署过程不会修改账户套餐。免费额度为账户共享，并非本项目独占；达到服务额度时应等待恢复或缩减用量，不需要升级付费。若免费资源不可用，工作流报错停止，不会购买替代资源。

## 从原 GitHub 登录方案升级 / 修改密码

1. 添加 `OWNER_USERNAME`、`OWNER_PASSWORD`、`NOTEBOOK_GITHUB_TOKEN` 这三个 Actions Secrets，模型和 Cloudflare 配置继续保留。原 `CLOUD_GITHUB_CLIENT_ID` / `CLOUD_GITHUB_CLIENT_SECRET` 已不再使用，可删除。
2. 推送更新后的代码到 `main`，运行 Knowledge Cloud，选择 **deploy**，只部署账号和发布接口，不重新调用模型生成知识库。首次上线需要 **deploy-and-sync**。
3. 刷新网页，用自定义账号登录。旧 GitHub 登录会话失效，浏览器旧设置中的发布 Token 在加载/保存时清空；旧的浏览器导出备份不受此操作影响。如曾在浏览器保存过旧令牌，迁移成功后可在 GitHub 撤销它，保留新的专用发布令牌。
4. 忘记密码或要改账号：修改对应 Actions Secret，再运行 **deploy**。修改账号或密码后旧会话立即失效；普通笔记同步和相同凭据的重新部署不影响登录。
5. 发布令牌到期时，在 GitHub 创建新的同权限令牌，更新 `NOTEBOOK_GITHUB_TOKEN`，再运行 **deploy**。

`NOTEBOOK_GITHUB_TOKEN` 是你创建的发布凭据，与 Actions 自动生成的 `GITHUB_TOKEN` 不同。后者只供工作流写入公开配置和 Wiki 快照，不可拿来作为长期 Worker 发布凭据。笔记通过个人令牌提交后，会按分支、文件路径和 `CLOUD_ENABLED` 配置触发工作流。[GitHub 令牌管理](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## 账号与发布边界

- 单一拥有者账号，无公开注册。公开阅读不需要登录，原始笔记草稿仍保存在浏览器，登录不会自动同步未发布草稿，也不会将公开仓库变成私有仓库。
- 部署时生成随机盐并保存在 D1，使用 PBKDF2-HMAC-SHA256（600,000 次）派生密码，再存储派生结果的 SHA-256 校验值于 Worker Secret `OWNER_AUTH`。密码明文仅存于你设置的 GitHub Actions Secret，不部署到 Worker。
- 浏览器执行同样的密码派生，经 HTTPS 提交派生凭据；它与密码一样敏感，不记录、不持久化。后端只做校验值比较，避免在免费 Worker 上运行昂贵的密码派生。盐是公开参数；账号与校验值不通过公开接口返回。PBKDF2 工作量参考 [OWASP 密码存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)，这里采用客户端派生以适配免费 CPU 预算。
- 每个 IP 每 15 分钟最多 5 次登录尝试，全站最多 50 次；成功登录同样计入。短时触发限制需等待下个时间窗口。会话最多 7 天，令牌只保存在当前标签页的 sessionStorage，退出时撤销服务端会话；所有私有 API 都在后端验证会话。
- 发布 API 将仓库和 `main` 分支固定在服务端，只允许 `notebooks/index.json`、`notebooks/favorites.json`、`notebooks/docs/*.json` 和 `notebooks/assets/` 下的文件，不接受客户端指定的其他仓库、分支或代码路径。
- 为控制免费 Worker 的内存与请求处理开销，云端发布单个笔记文件或附件上限 **5 MB**。本地可保留更大附件，发布前需压缩。已存在于仓库的较大附件不会重新上传。实际 CPU 仍需上线验收，若超限应缩小附件。
- 登录是服务器数据的访问控制；本地草稿位于浏览器，不是加密保险箱。只在信任的浏览器环境中使用。

## 可选 Variables

| 名称 | 默认值 |
|---|---|
| `FRONTEND_ORIGIN` | `https://xerifg.github.io`，必须是网站实际来源，无路径或末尾斜杠 |
| `CHAT_BASE_URL` / `CHAT_MODEL` | `https://api.deepseek.com/v1` / `deepseek-chat` |
| `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` | `https://api.siliconflow.cn/v1` / `Qwen/Qwen3-Embedding-0.6B` |
| `RERANK_BASE_URL` / `RERANK_MODEL` | `https://api.siliconflow.cn/v1` / `Qwen/Qwen3-Reranker-0.6B` |

当前向量维度固定为 **1024**。换向量模型后必须重新运行 `deploy-and-sync`；新索引未就绪期间会明确提示模型不匹配，不会使用不兼容向量。默认每天最多 100 个提问；深入比较最多拆成两次检索。限额可在 `cloud/wrangler.jsonc` 修改，但免费额度不会因此增加。

## 已实现的行为

- 问答：中文关键词与向量混合检索、RRF 融合、重排、按笔记/文件夹/标签筛选、多轮问题改写、深入比较、流式输出与停止、原文引用和标题定位、最多保留每段对话最近 20 条消息。
- 检索故障：向量或重排不可用时显示降级说明；没有足够证据时不调用回答模型。
- Wiki：从已发布笔记抽取概念与实体，合并明确的同义名称，生成带编号证据和双向可探索链接的条目。图谱支持全局概览、一层/两层展开、搜索定位、缩放、点击节点和键盘操作；最多显示 100 个节点。
- 人工编辑：生成内容与人工稿分开；保存、对比新生成稿、历史预览、恢复为新版本、Markdown 下载、JSON 备份导出。保留最近 50 次人工版本及首次编辑的生成底稿。
- 引用保护：人工稿保存当时的原文证据。笔记变化后标记“原文已更新”，引用不会悄悄重指到新片段；采用最新底稿才改用新版证据。
- 同步保护：读取完整发布清单，任何文件缺失或格式错误都终止导入；新版本全部写入且向量可查询后才切换生效指针。失败保持旧索引；下一次构建清理失效版本。旧请求已取得的证据随回答保留。
- 增量费用：相同内容和模型的向量、抽取结果、Wiki 整理结果缓存复用。更改邻接条目可能使相关 Wiki 重新生成，不保证只调用一次模型。

这套图谱是 **Wiki 条目及其链接图**，不是部署 Neo4j，也不是 WeKnora 全产品移植。生成内容仍需按引用核对。当前导入 HTML 笔记中的正文、表格文本、代码、LaTeX 和 Mermaid 源码；图片仅索引说明文字，不包含 OCR、视频转写或外链全文抓取。

## 免费容量与运行边界

实际离线解析本仓库得到 **77 篇笔记、559 个片段**。1024 维时单代为 572,416 个维度，正常保留当前与前一代约 114 万维度。构建会在“当前＋待发布”超过 **4500 个向量**时停止，留出免费容量余量；不会删除当前索引来强行腾空间。

Cloudflare 官方列出的 Vectorize Free 配额是 500 万存储维度、每月 3000 万查询维度；查询维度按官方公式计算，不能理解为不限查询。[Vectorize 定价](https://developers.cloudflare.com/vectorize/platform/pricing/)

Workers Free 每请求 CPU 时间有限，因此批量解析、抽取和生成都放到 GitHub Actions；流式回答由 Worker 原样转发，浏览器完成解析后再以单独请求保存历史，不在 Worker 中逐 token 处理。关闭页面或停止回答不会保存未完成的流；供应商已生成的 token 仍可能计费。真实 Cloudflare CPU、供应商延迟和所在地访问性须在首次部署后测量。[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)

D1 Free 单数据库上限 500 MB，本项目包括向量缓存、原文、人工版本和对话，因此不是无限存储。长期使用需清理旧对话，监控 Cloudflare 控制台的 D1 与 Vectorize 额度；仓库大型附件不进入 D1。[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)

## 备份与恢复

- 发布笔记继续由 Git 版本管理。自动生成的 Wiki 快照写入 `notebooks/knowledge/wiki.json`，可查看 Git 历史。快照不包含登录会话、密钥、对话或人工编辑内容。
- 人工编辑及版本保存在 D1；可在 Wiki 页面点击“导出 Wiki 备份”下载 JSON，或从 Cloudflare 导出数据库。人工编辑不会自动提交到公开仓库。
- 索引可以从原笔记和缓存重新构建。要撤回错误的笔记发布，应先在 GitHub 恢复原笔记，再运行 `sync`；手工 Wiki 编辑在页面中通过“历史版本”恢复。
- 整个数据库灾难恢复使用 Cloudflare D1 的数据库导出/恢复功能；JSON 导出目前用于独立存档，不提供一键导入或覆盖数据库。

## 上线验收

1. `/health` 返回正常，未登录访问 `/api/wiki` 或 `/api/repository` 返回 401；错误账号或密码被拒绝；正确登录后发布、问答、Wiki 共用会话，退出后私有接口均返回 401。
2. 提一个明确出现在笔记中的问题，核对回答引用的原文；按文件夹筛选后证据不得越界。
3. 追问“与上一种方法有什么不同”，确认多轮改写有效。停止一条长回答后，其未完成内容不得进入云端历史。
4. 打开 Wiki → 图谱 → 点击节点，核对条目与来源，检查一层/两层切换。
5. 编辑一条 Wiki 并保存，然后发布相关笔记修改、运行同步。人工稿应保留，并提示证据已变化。
6. 模拟错误模型设置，使构建失败；上一份有效索引应保持。用恢复后的设置重试应复用缓存。
7. 发布一篇带小附件的笔记，确认浏览器请求发送到 Worker，未出现 GitHub Token；原文与索引写入 main 后 Actions 自动运行。删除测试笔记并发布，确认同步清理。
8. 在 Cloudflare 控制台确认 Worker 请求没有 CPU 超限、D1/Vectorize 使用量仍在免费额度内；浏览器不得收到供应商 API Key。

## 开发验证

```text
node --test cloud/tests/*.test.mjs
python -m unittest discover -s cloud/tests -p "test_*.py"
python cloud/build/sync.py --dry-run
node --check static/app.js
node --check static/cloud-ui.mjs
```

测试使用内存 SQLite、临时笔记和模拟模型，不访问付费模型或修改线上库。受限 Windows 沙箱可给 Node 测试加 `--experimental-test-isolation=none`。

已知上线前限制：没有账户凭据时，离线测试不能证明真实账号登录、GitHub 写入、实际 Vectorize 就绪时序、Workers 免费 CPU 预算或模型供应商的真实响应质量。必须完成上面的在线验收后再将服务视为上线完成。
