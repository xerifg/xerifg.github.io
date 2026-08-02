# Mermaid 源码渲染设计

## 目标

将 Mermaid 功能收敛为源码优先的图表块：用户粘贴或编辑完整 Mermaid 源码，文档使用 Mermaid 官方运行时渲染图形。首版不提供节点拖拽、连线编辑或自动布局画布。

## 交互

- 加号浮窗保留“Mermaid 流程图”入口，插入一段可工作的示例源码。
- 阅读状态只显示 SVG 图形。
- 选中后点击“编辑源码”切换到源码输入区，同时保留预览。
- 每次源码变更由 Mermaid 官方渲染器尝试渲染；成功即替换预览，失败则保留上一次成功的预览、保留原始输入，并显示中文错误提示。
- 复杂 Mermaid 语法（注释、`classDef`、`class`、`subgraph`、多输入连线、HTML 换行和其他 Mermaid 图类型）不经过本地简化解析器，直接交给 Mermaid 运行时。

## 数据和组件

- Tiptap `mermaidDiagram` 节点只持久化 `code` 和 `error`。移除 `graph`、`positions` 以及画布特有状态。
- `MermaidDiagramView` 管理预览与源码编辑状态。
- `MermaidPreview` 调用 Mermaid 的严格安全渲染器；渲染结果是唯一的阅读态表示。
- 删除 `MermaidFlowCanvas`、流程图模型转换器及相关 UI、测试，避免任何对 Mermaid 语法的二次解释。

## 安全与错误处理

- Mermaid 初始化固定使用 `securityLevel: "strict"`，不启用图内 HTML 交互或脚本。
- 任意渲染失败仅影响当前图表块；不影响文档保存、其他块或最后一个有效 SVG。
- 错误信息说明源码未能被 Mermaid 渲染，而不笼统称为“流程图语法”错误。

## 验证

- 插入菜单仍能插入 Mermaid 块并在块后创建普通段落。
- 含 `classDef`、`subgraph`、注释和多输入连线的源码会直通 Mermaid 渲染，不触发本地解析错误。
- 节点序列化后只包含 `code` 和 `error`，重新加载文档可再次渲染。
- 语法失败保留原始源码和最后成功预览。
- 菜单在紧凑视口中仍优先展示 Mermaid 入口。
