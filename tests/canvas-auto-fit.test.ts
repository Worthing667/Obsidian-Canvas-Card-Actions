import * as assert from 'node:assert/strict';
import {
  fitSelectedTextCardsToHeight,
  shouldShowAutoHeightToolbarButton
} from '../src/services/CanvasAutoFitService';
import type { Canvas, CanvasNode, CanvasResizeHandle } from '../src/types/canvas';

function node(
  id: string,
  type = 'text',
  onResizeDblclick?: (event: MouseEvent, resizeHandle: CanvasResizeHandle) => void
): CanvasNode {
  return {
    id,
    getData: () => ({
      id,
      type,
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      text: type === 'text' ? id : undefined,
    }),
    onResizeDblclick,
  };
}

function canvas(selection: CanvasNode[], onSave: () => void = () => undefined): Canvas {
  return {
    selection: new Set(selection),
    getData: () => ({ nodes: selection.map((item) => item.getData()), edges: [] }),
    setData: () => undefined,
    requestSave: () => onSave(),
  };
}

function testToolbarButtonRequiresOneTextCard() {
  const textNode = node('text');
  const fileNode = node('file', 'file');

  assert.equal(shouldShowAutoHeightToolbarButton(), false);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([fileNode])), false);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([textNode])), true);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([textNode, fileNode])), true);
}

async function testFitsSelectedTextCardsOnly() {
  const calls: string[] = [];
  let saveCount = 0;
  const textA = node('a', 'text', (event, resizeHandle) => {
    event.preventDefault();
    calls.push(`a:${resizeHandle}`);
  });
  const textB = node('b', 'text', (event, resizeHandle) => {
    event.preventDefault();
    calls.push(`b:${resizeHandle}`);
  });
  const fileNode = node('file', 'file', () => calls.push('file'));

  const result = await fitSelectedTextCardsToHeight(canvas([textA, fileNode, textB], () => {
    saveCount += 1;
  }));

  assert.equal(result.count, 2);
  assert.deepEqual(calls, ['a:bottom', 'b:bottom']);
  assert.equal(saveCount, 1);
}

async function testRejectsUnsupportedRuntimeNodes() {
  await assert.rejects(
    () => fitSelectedTextCardsToHeight(canvas([node('a')])),
    /不支持批量自适应高度/
  );
}

void (async () => {
  testToolbarButtonRequiresOneTextCard();
  await testFitsSelectedTextCardsOnly();
  await testRejectsUnsupportedRuntimeNodes();
  console.log('canvas auto fit tests passed');
})();
