# Personal Notebook

一个部署在 GitHub Pages 上的静态个人笔记本。页面本身不依赖后端服务，笔记内容通过 GitHub Contents API 写回当前仓库。

## 功能

- GitHub Pages 静态部署
- Tiptap/ProseMirror 富文本编辑器
- 飞书式加号菜单、斜杠菜单、选区工具条
- 文件夹、文档、标签管理
- 浏览器本地草稿自动保存
- 点击「发表」后写入 GitHub 仓库
- 支持上传图片、视频和文件附件
- 本地编辑时附件先缓存，发表后上传到仓库并改为线上相对路径

## 目录结构

```text
index.html              # GitHub Pages 入口
static/
  app.js                # 笔记本前端逻辑
  app.css               # 笔记本样式
notebooks/
  index.json            # 已发表文档索引
  docs/                 # 已发表文档 JSON
  assets/               # 发表后的图片、视频、文件附件
server.py               # 本地编辑辅助服务
start-notebook.cmd      # Windows 本地启动脚本
.env.example            # 本地服务配置示例
```

## 在线使用

访问：

```text
https://xerifg.github.io/
```

如果浏览器曾打开过早期页面，建议使用无痕窗口或强制刷新：

```text
https://xerifg.github.io/?v=notebook
```

## GitHub Pages 配置

在仓库的 `Settings -> Pages` 中保持以下配置：

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

保存后 GitHub Pages 会从仓库根目录的 `index.html` 发布页面。

## 编辑和发表

1. 打开笔记本首页。
2. 点击「编辑」进入编辑模式。
3. 首次编辑或发表时输入账号和密码。
4. 内容会先保存到浏览器本地草稿。
5. 点击「发表」后，当前文档会保存到：

```text
notebooks/docs/
```

同时文档索引会更新到：

```text
notebooks/index.json
```

## 附件上传

编辑器支持三类附件：

- 图片：插入为图片预览
- 视频：插入为播放器
- 文件附件：插入为下载卡片

本地编辑时，附件会优先缓存到：

```text
.notebook-cache/assets/
```

点击「发表」后，附件会上传到仓库：

```text
notebooks/assets/{noteId}/
```

文档中的本地临时地址会被替换为仓库内相对路径，因此线上访问时图片、视频和文件都来自 GitHub Pages。

默认大小限制：

```text
图片：10 MB
视频：80 MB
文件：50 MB
```

GitHub 仓库不适合长期存放很大的视频。如果需要大量视频，建议使用外部对象存储或 CDN。

## 本地运行

直接打开 `index.html` 可以阅读和使用基础功能。若要支持本地附件缓存和本地预览，请启动本地服务：

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

复制 `.env.example` 为 `.env`，并按需修改：

```text
NOTEBOOK_USER=admin
NOTEBOOK_PASSWORD=change-this-password
NOTEBOOK_SECRET=change-this-random-session-secret

GITHUB_OWNER=xerifg
GITHUB_REPO=xerifg.github.io
GITHUB_BRANCH=main
GITHUB_TOKEN=github_pat_xxx

PORT=8000
```

说明：

- `NOTEBOOK_USER` 和 `NOTEBOOK_PASSWORD` 用于本地编辑验证。
- `GITHUB_TOKEN` 用于本地服务代理写入 GitHub。
- 在线 GitHub Pages 模式下，浏览器会通过 GitHub Contents API 写入当前仓库。

## 发布

提交并推送到 `main` 分支即可触发 GitHub Pages 部署：

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
