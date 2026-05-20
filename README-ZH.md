# Canvas Loom

`Canvas Loom` 是一个 Obsidian Canvas 增强插件，用来拆分、排序、拼合、预览和整理 Canvas 文本卡片。

它把零散的 Canvas 文本卡片变成一条可重复的工作流：长文拆成卡片，多卡片按位置或标记排序，先预览再导出，最后把卡片尺寸和间距整理干净。

## 核心演示

<video src="Demo/侧栏工作台：预览卡片组_复制_新建文稿_新建卡片_清空.mp4" controls muted width="100%"></video>

## 核心工作流

### 拆分卡片

<video src="Demo/卡片拆分_三种拆分方式_限制拆分后的单行卡片数量.mp4" controls muted width="100%"></video>

单张长文本卡片可以按自定义分隔符、空行或 Markdown 标题层级拆分。插件会保留原卡片，并把后续内容追加成新的 Canvas 卡片。

### 拼合卡片

<video src="Demo/一键拼合：拼合后是否保存原卡片_按位置or标记顺序拼合.mp4" controls muted width="100%"></video>

选中多张卡片后，可以直接一键拼合，也可以先载入 Loom 工作台，切换排序、预览结果，再输出到剪贴板、Canvas 新卡片或 Markdown 文稿。

### 按位置或标记排序

<video src="Demo/预览卡片组：按位置排序和按标记排序的区别.mp4" controls muted width="100%"></video>

位置排序跟随画布上的视觉排布。标记排序跟随 `1`、`2.1`、`10.3.2` 这类数字层级标记，所以卡片位置被挪动后，输出顺序仍然可以保持稳定。

### 整理版面

<video src="Demo/自适应高度_整理间距.mp4" controls muted width="100%"></video>

让卡片高度适配文本内容，并对选中的多张卡片整理水平或垂直间距，减少重复拖拽。

## 界面截图

<table>
  <tr>
    <td width="50%"><img src="Demo/侧栏预览_按标记顺序.png" alt="按标记顺序预览卡片组" /></td>
    <td width="50%"><img src="Demo/卡片标记效果.png" alt="Canvas 卡片标记效果" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="Demo/多卡片属性管理器.png" alt="多卡片属性管理器" /></td>
    <td width="50%"><img src="Demo/设置界面功能展示.png" alt="Canvas Loom 设置界面" /></td>
  </tr>
</table>

## 功能概览

- `拆分卡片...`
  支持按自定义分隔符、空行或 Markdown 标题层级拆分。
- `预览卡片组`
  将选中的文本卡片组载入 Loom 工作台，切换排序、拖拽微调当前顺序、预览结果，并输出为剪贴板、画布卡片或 Markdown 文稿。
- `一键复制` / `一键拼合`
  按设置中的默认排序方式处理多张卡片。
- `添加/编辑标记`
  支持 `1`、`2.1`、`10.3.2` 这类数字层级标记。
- `管理卡片属性`
  统一处理单卡片查看，以及多卡片批量尺寸和宽高比调整。
- `整理间距` / `自适应高度`
  在 Canvas 选区浮动工具栏中整理卡片排布。
- `选中同色卡片`
  从单张或多张卡片出发，选中同色文本卡片，也可以进入同色分组预览。

## 插件设置

- `设置画布卡片分隔符`：控制分隔符拆分使用的文本
- `设置卡片排序优先级`：控制位置排序优先按纵向还是横向
- `一键排序方式`：控制一键复制和一键拼合的默认排序模式
- `拼合后处理方式`：控制拼合为新卡片后保留或删除原卡片
- `启用标记功能`：控制是否显示卡片标记
- `启用 Canvas 性能模式`：降低大型 Canvas 中 Canvas Loom 的附加渲染开销
- `启用性能诊断日志`：在开发者控制台输出操作耗时和节点统计
- `大 Canvas 阈值` / `标记更新防抖时间`：控制标记分帧更新策略

## 权限与隐私说明

- 不需要账号，不接入付费服务
- 不包含广告，不采集遥测数据，不上传用户内容
- 不主动联网
- 仅在用户手动触发命令时，读取当前 Obsidian 仓库中的 Canvas 或 Markdown 内容
- 仅在用户明确执行导出、拼合或新建文稿相关操作时，在当前仓库内创建或修改文件
- 支持将选中卡片内容复制到系统剪贴板

## 安装

### 从 GitHub 发布页安装

1. 打开本仓库的 [发布页](https://github.com/woxin667/Canvas-Loom/releases)
2. 下载 `main.js`、`manifest.json`、`styles.css`
3. 将这三个文件放入 `.obsidian/plugins/canvas-loom/`
4. 在 Obsidian 中启用插件

### 本地构建

```bash
npm install
npm run build
```

## 开发

- `npm run dev`：开发模式
- `npm run build`：生产构建
- `npm run version`：同步更新版本号

## 文档

文档索引见 [docs/README.md](./docs/README.md)。

建议优先阅读：

- `docs/功能-拆分Canvas卡片.md`
- `docs/功能-卡片内容复制与排序.md`
- `docs/功能-卡片标记.md`
- `docs/功能-查看和编辑卡片属性.md`
- `docs/技术实现细节.md`
- `docs/技术实现-Obsidian官方上架与发布流程.md`

## 致谢

早期开发参考了 **joshuakto** 的开源项目 [obsidian-cardify](https://github.com/joshuakto/obsidian-cardify)。
