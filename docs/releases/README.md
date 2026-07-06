# Release notes

每次发布前，在本目录新增一个以版本号命名的发布说明文件：

```text
docs/releases/<version>.md
```

例如：

```text
docs/releases/1.8.4.md
```

## 格式

发布说明面向用户，使用中英逐行对照。中文条目的下一行必须是对应英文条目。

```md
## Canvas Loom 1.8.4

- 新增：可以在 Canvas 中显示缩放控件。
- Added: Show a zoom control directly in Canvas.

- 优化：设置页中的支持入口更加清晰。
- Improved: Support links in settings are easier to find.

- 修复：修正部分 Canvas 场景下标记显示不稳定的问题。
- Fixed: Badges are more reliable in some Canvas views.
```

## AI 拟稿提示词

发布前可以把上一个 tag 到当前版本的变更交给 AI，按以下要求拟稿：

```text
请根据以下版本变更，为 Canvas Loom 拟定 GitHub Release 发布消息。

要求：
- 面向普通用户，简练，不写过细技术细节。
- 包含本次发布所有用户可感知的更改。
- 使用中英逐行对照格式：每条中文下一行必须是对应英文。
- 中文条目前缀只能使用：新增、优化、修复、移除、兼容性、说明。
- 英文条目前缀对应使用：Added、Improved、Fixed、Removed、Compatibility、Note。
- 不要写 commit hash、PR 编号、源码路径、内部文件名。

版本：<version>
变更范围：<previous-tag>..<release-commit>
变更内容：
<粘贴 git log、相关 diff 摘要或人工整理的变更清单>
```

## 校验

保存发布说明后执行：

```bash
npm run release:check -- <version>
```

GitHub Release workflow 也会在创建 Release 前执行同一项检查，并将 `docs/releases/<version>.md` 作为 Release 正文。
