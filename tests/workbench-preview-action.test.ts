import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const viewSource = readFileSync(
  resolve(process.cwd(), 'src/presentation/views/MergeWorkbenchView.ts'),
  'utf8'
);
const zhWorkbenchSource = readFileSync(
  resolve(process.cwd(), 'src/i18n/dictionaries/zh-CN/workbench.ts'),
  'utf8'
);
const enWorkbenchSource = readFileSync(
  resolve(process.cwd(), 'src/i18n/dictionaries/en/workbench.ts'),
  'utf8'
);

assert.match(zhWorkbenchSource, /viewPreview:\s*"查看预览"/);
assert.match(enWorkbenchSource, /viewPreview:\s*"View preview"/);

assert.match(viewSource, /workbench\.button\.viewPreview/);
assert.match(viewSource, /setIcon\(button,\s*"eye"\)/);
assert.doesNotMatch(
  viewSource,
  /button\.createSpan\(\{\s*text:\s*this\.translate\("workbench\.button\.render"\)\s*\}\)/,
  '排序页预览按钮不应再显示“渲染”。'
);

assert.match(
  viewSource,
  /if \(this\.context\.state\.lastComputedContent\) \{\s*preview\.setText\(this\.context\.state\.lastComputedContent\);\s*return;\s*\}/,
  '预览内容已由按钮生成时，预览页不应再次调度生成。'
);

console.log('workbench preview action tests passed');
