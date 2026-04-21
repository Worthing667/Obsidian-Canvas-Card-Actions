# Canvas Loom

`Canvas Loom` 是一个 Obsidian Canvas 增强插件，聚焦四类高频操作：

- 拆分单张文本卡片
- 复制、拼合和预览多张卡片内容
- 为卡片添加徽章
- 查看和调整卡片属性

当前版本：`1.4.0`

## 功能概览

- `拆分卡片...`
  支持按自定义分隔符或 Markdown 标题层级拆分。
- `复制卡片内容`
  复制单张文本卡片的纯文本内容。
- `一键复制` / `一键拼合`
  按设置中的默认排序方式处理多张卡片。
- `打开预览...`
  在工作台中切换排序、预览结果，并输出为剪贴板、画布卡片或 Markdown 文稿。
- `添加/编辑徽章`
  支持数字、文字和表情徽章。
- `管理卡片属性`
  统一处理单卡片查看和多卡片批量尺寸调整。

## 界面演示

下面这组截图适合直接放在主页，基本能把插件的主要使用路径说明白。

### 1. 拆分文本卡片

<p align="center">
  <img src="Demo/按标题_拆分卡片_选择器.png" alt="拆分卡片方式选择器" width="48%" />
  <img src="Demo/按标题_拆分卡片.png" alt="按标题层级拆分后的画布卡片" width="48%" />
</p>

单张长文本卡片可以先选择拆分方式，再按分隔符或 Markdown 标题层级拆成多张新卡片。

### 2. 多卡片整理与导出

<p align="center">
  <img src="Demo/一键拼合卡片.png" alt="多卡片一键拼合" width="48%" />
  <img src="Demo/侧边栏工作台.png" alt="侧边栏工作台预览与导出" width="48%" />
</p>

选中多张卡片后，可以直接一键拼合，也可以进入侧边栏工作台切换排序模式、预览结果，并输出到剪贴板、画布卡片或 Markdown 文稿。

### 3. 右键菜单入口

<p align="center">
  <img src="Demo/单卡片右键菜单.png" alt="单卡片右键菜单" width="31%" />
  <img src="Demo/多卡片右键菜单.png" alt="多卡片右键菜单" width="31%" />
  <img src="Demo/一键统一卡片尺寸_3后.png" alt="统一尺寸后的多卡片效果" width="31%" />
</p>

单卡片和多卡片场景分别提供不同的右键操作入口，批量整理后的画布效果也能直接在画布中看到。

### 4. 卡片属性管理

<p align="center">
  <img src="Demo/单卡片属性管理.png" alt="单卡片属性管理面板" width="48%" />
  <img src="Demo/多卡片属性管理.png" alt="多卡片属性管理面板" width="48%" />
</p>

属性管理支持查看尺寸和坐标、复制位置信息，以及对多张卡片执行统一最小尺寸、最大尺寸或平均尺寸等批量调整。

## 插件设置

- `设置画布卡片分隔符`：控制分隔符拆分使用的文本
- `设置卡片排序优先级`：控制位置排序优先按纵向还是横向
- `一键排序方式`：控制一键复制、一键拼合和工作台默认排序模式
- `启用徽章功能`：控制是否显示卡片徽章

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
2. 下载 `obsidian-canvas-loom-x.y.z.zip`
3. 将 `main.js`、`manifest.json`、`styles.css` 放入 `.obsidian/plugins/obsidian-canvas-loom/`
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
