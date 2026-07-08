# Personal Notebook

一个部署在 GitHub Pages 上的个人知识库和笔记本。前端直接运行在浏览器中，阅读、编辑、标签网络、附件预览和发布都围绕 `notebooks/` 目录工作；本地辅助服务只用于本地预览、附件缓存和可选的 GitHub 写入代理。

## 当前功能

- GitHub Pages 静态访问，入口为 `index.html`。
- Tiptap/ProseMirror 富文本编辑器，支持标题、列表、引用、代码块、表格、任务列表、链接、高亮、图片、视频和文件附件。
- 左侧文档库支持文件夹、文档、标签、搜索、重命名和删除。
- 标签网络视图用于查看标签关系和相关笔记。
- 浏览器本地草稿自动保存，未发布内容不会丢失。
- 发布时把文档索引写入 `notebooks/index.json`，把单篇文档写入 `notebooks/docs/`。
- 附件先缓存在本地或浏览器中，发布后上传到 `notebooks/assets/{noteId}/` 并替换为仓库相对路径。
- 发布前验证 GitHub token，并处理文档路径去重、删除文档同步和 GitHub 写入冲突重试。

## 实现路线

当前实现以纯静态前端为主：

1. 页面由 `index.html` 加载 `static/app.css` 和 `static/app.js`。
2. `static/app.js` 负责 React UI、Tiptap 编辑器、文档库状态、发布流程和 GitHub Contents API 调用。
3. `static/network-model.mjs` 提供标签关系计算和网络布局，相关逻辑有独立测试。
4. `server.py` 是本地辅助服务，提供静态文件服务和本地附件缓存接口。
5. 已发布内容存放在 `notebooks/` 下，GitHub Pages 直接读取这些 JSON 和资源文件。

## 目录结构

```text
index.html              # GitHub Pages 入口
static/
  app.js                # 前端应用、编辑器、发布逻辑
  app.css               # 页面样式
  network-model.mjs     # 标签网络数据模型
notebooks/
  index.json            # 已发布文档索引
  docs/                 # 已发布文档 JSON
  assets/               # 已发布附件资源
tests/
  network-model.test.mjs # 标签网络模型测试
server.py               # 本地辅助服务
start-notebook.cmd      # Windows 本地启动脚本
```

## 在线使用

访问：

```text
https://xerifg.github.io/
```

如果浏览器缓存了早期页面，可以强制刷新，或访问：

```text
https://xerifg.github.io/?v=notebook
```

## GitHub Pages 配置

仓库 `Settings -> Pages` 保持以下配置：

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

提交并推送到 `main` 后，GitHub Pages 会从仓库根目录发布页面。

## 编辑和发布

1. 打开笔记本首页。
2. 点击编辑入口进入编辑模式。
3. 首次编辑或发布时输入 GitHub 账号和有仓库写入权限的 token。
4. 内容会先保存到浏览器本地草稿。
5. 点击发布后，全部文档和索引会写回当前 GitHub Pages 仓库。

发布后的核心文件：

```text
notebooks/index.json
notebooks/docs/*.json
notebooks/assets/{noteId}/
```

## 附件处理

编辑器支持三类附件：

- 图片：插入为图片预览。
- 视频：插入为播放器。
- 文件附件：插入为下载卡片。

本地服务运行时，附件会先缓存到：

```text
.notebook-cache/assets/
```

发布后，附件会上传到：

```text
notebooks/assets/{noteId}/
```

文档中的本地临时地址会替换为仓库内相对路径，因此线上访问时资源来自 GitHub Pages。

## 本地运行

直接打开 `index.html` 可以阅读和使用基础功能。需要本地附件缓存或稳定预览时，启动本地服务：

```cmd
start-notebook.cmd
```

或手动运行：

```bash
python server.py
```

默认地址：

```text
http://127.0.0.1:8000/
```

## 本地服务配置

本地服务默认监听 `8000` 端口。如需修改，可设置环境变量：

```text
PORT=8000
```

编辑和发布仍由浏览器直接使用 GitHub token 调用 GitHub Contents API，不经过 `server.py`。

## 测试

运行标签网络模型测试：

```bash
node tests/network-model.test.mjs
```

检查前端脚本语法：

```bash
node --check static/app.js
```

## 发布

```bash
git add .
git commit -m "update notebook"
git push origin main
```

部署完成后访问：

```text
https://xerifg.github.io/
```

## License

MIT
