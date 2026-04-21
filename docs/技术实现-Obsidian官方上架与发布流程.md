# 技术实现：Obsidian 官方上架与发布流程

本文档用于约束 `Canvas Loom` 提交到 Obsidian 官方插件市场时的发布方式、仓库结构和提审步骤，避免版本号、发布资产或仓库元数据不一致导致审核被退回。

## 目标

- 保证 GitHub Release 中始终包含官方审核需要的发布资产
- 保证 `manifest.json`、`package.json`、`versions.json` 与 Git tag 版本一致
- 保证仓库 README 能明确说明功能、权限边界和安装方式
- 保证向 `obsidianmd/obsidian-releases` 提交时可以直接复用固定字段

## 当前仓库约定

### 插件标识

- 插件 `id`：`obsidian-canvas-loom`
- 插件名称：`Canvas Loom`
- 仓库地址：`https://github.com/woxin667/Canvas-Loom`
- 默认分支：`main`
- 发布 tag 格式：`v主版本.次版本.修订版本`

### 版本文件

发布版本时需要同时检查以下文件：

- `manifest.json`
- `package.json`
- `versions.json`
- `README.md`

其中：

- `manifest.json` 中的 `version` 是 Obsidian 官方审核和安装使用的主版本号
- `package.json` 中的 `version` 应与 `manifest.json` 保持一致
- `versions.json` 需要补充当前版本对应的最低兼容 Obsidian 版本
- `README.md` 中展示的“当前版本”应同步更新，避免页面信息落后于实际发布版本

### 发布产物

官方插件市场审核依赖以下发布资产：

- `manifest.json`
- `main.js`
- `styles.css`

说明：

- `main.js` 属于构建产物，不再作为源码文件长期跟踪
- 仓库根目录中的 `main.js` 由构建命令生成，用于打包 GitHub Release
- 发布时必须确保 Release 中上传的是当前版本构建结果

## GitHub Release 流程

### 构建命令

本项目使用以下命令生成发布产物：

```bash
npm run build
```

构建结果会：

- 产出 `build/main.js`
- 同步复制 `manifest.json` 与 `styles.css` 到 `build/`
- 将最新 `build/main.js` 覆盖到仓库根目录的 `main.js`

### 自动发布工作流

仓库内使用以下工作流生成 GitHub Release：

- `.github/workflows/release.yml`

触发条件：

- 推送符合 `v*.*.*` 的 Git tag，例如 `v1.4.1`

工作流行为：

1. 安装依赖
2. 执行 `npm run build`
3. 收集 `manifest.json`、`main.js`、`styles.css`
4. 打包为 `obsidian-canvas-loom-版本号.zip`
5. 创建对应的 GitHub Release 并上传以上文件

## 提审前检查清单

正式提交到官方插件市场前，至少完成以下检查：

1. `manifest.json` 的 `id` 没有与官方插件列表冲突
2. `manifest.json`、`package.json`、`versions.json` 的版本号一致
3. 本地执行 `npm run build` 成功
4. `README.md` 已包含功能说明、安装方式和权限与隐私说明
5. 仓库中不存在明显无意义的调试日志或演示性质的提交内容
6. GitHub Release 已包含 `manifest.json`、`main.js`、`styles.css`
7. GitHub Release 的 tag 与当前仓库约定一致，例如 `v1.4.1`

## 提交到官方插件市场

### 提交位置

提交入口：

- `https://github.com/obsidianmd/obsidian-releases`

提交方式：

- 修改 `community-plugins.json`
- 新增当前插件条目
- 发起 Pull Request 等待机器人检查与人工审核

### 当前仓库对应条目

当前项目提交到 `community-plugins.json` 时可使用以下内容：

```json
{
  "id": "obsidian-canvas-loom",
  "name": "Canvas Loom",
  "author": "沃辛",
  "description": "为 Obsidian Canvas 添加卡片拼合、拆分、内容复制和添加标记的功能",
  "repo": "woxin667/Canvas-Loom"
}
```

如后续仓库迁移、作者名调整或插件定位变化，应同步更新该条目与 `manifest.json`、`README.md` 中的对应信息。

## README 需要覆盖的内容

为了降低审核往返成本，README 应长期保持以下内容可见：

- 插件主要功能
- 界面演示或截图
- 安装方式
- 构建方式
- 权限与隐私说明
- 与 Canvas 相关的行为边界，例如何时读取内容、何时写入文件、何时复制到系统剪贴板

## 后续维护建议

- 每次发布前先执行一次完整的版本同步，再创建 tag
- 如果功能范围、数据读写范围或外部依赖发生变化，优先更新 README 中的权限与隐私说明
- 如果发布流程发生变化，优先更新本文件和 `.github/workflows/release.yml`
- 每次对发布或提审流程有改动后，都应检查 `docs/README.md` 的索引是否仍然正确
