import * as assert from 'node:assert/strict';
import {
  fitSelectedTextCardsToHeight,
  shouldShowAutoHeightToolbarButton
} from '../src/services/CanvasAutoFitService';
import type { Canvas, CanvasNode, CanvasResizeHandle } from '../src/types/canvas';

function node(
  id: string,
  type = 'text',
  onResizeDblclick?: (event: MouseEvent, resizeHandle: CanvasResizeHandle) => void,
  nodeEl?: HTMLElement | null
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
    nodeEl,
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

function testToolbarButtonRequiresOneResizableCard() {
  const textNode = node('text', 'text', () => undefined);
  const fileNode = node('file', 'file');

  assert.equal(shouldShowAutoHeightToolbarButton(), false);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([fileNode])), false);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([textNode])), true);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([textNode, fileNode])), true);
}

function testToolbarButtonSupportsThumbnailCardsWithResizeHandler() {
  const thumbnailNode = node('thumb', 'file', () => undefined);

  assert.equal(shouldShowAutoHeightToolbarButton(new Set([thumbnailNode])), true);
}

function testToolbarButtonHidesForEditingCards() {
  const editingEl = {
    classList: { contains: (className: string) => className === 'is-editing' },
    querySelector: () => null,
  } as unknown as HTMLElement;
  const editingNode = node('editing', 'text', () => undefined, editingEl);
  const normalNode = node('normal', 'text', () => undefined);

  assert.equal(shouldShowAutoHeightToolbarButton(new Set([editingNode])), false);
  assert.equal(shouldShowAutoHeightToolbarButton(new Set([editingNode, normalNode])), false);
}

async function testFitsSelectedResizableCards() {
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

  assert.equal(result.count, 3);
  assert.deepEqual(calls, ['a:bottom', 'file', 'b:bottom']);
  assert.equal(saveCount, 1);
}

async function testFitsSelectedThumbnailCards() {
  const calls: string[] = [];
  let saveCount = 0;
  const thumbnailNode = node('thumb', 'file', (event, resizeHandle) => {
    event.preventDefault();
    calls.push(`thumb:${resizeHandle}`);
  });

  const result = await fitSelectedTextCardsToHeight(canvas([thumbnailNode], () => {
    saveCount += 1;
  }));

  assert.equal(result.count, 1);
  assert.deepEqual(calls, ['thumb:bottom']);
  assert.equal(saveCount, 1);
}

async function testSkipsEditingCardsDuringFit() {
  const calls: string[] = [];
  const editingEl = {
    classList: { contains: (className: string) => className === 'is-editing' },
    querySelector: () => null,
  } as unknown as HTMLElement;
  const editingNode = node('editing', 'text', () => {
    calls.push('editing');
  }, editingEl);

  await assert.rejects(
    () => fitSelectedTextCardsToHeight(canvas([editingNode])),
    /请先退出卡片编辑状态/
  );
  assert.deepEqual(calls, []);
}

async function testRejectsMixedSelectionWithEditingCardsDuringFit() {
  const calls: string[] = [];
  const editingEl = {
    classList: { contains: (className: string) => className === 'is-editing' },
    querySelector: () => null,
  } as unknown as HTMLElement;
  const editingNode = node('editing', 'text', () => {
    calls.push('editing');
  }, editingEl);
  const normalNode = node('normal', 'text', () => {
    calls.push('normal');
  });

  await assert.rejects(
    () => fitSelectedTextCardsToHeight(canvas([editingNode, normalNode])),
    /请先退出卡片编辑状态/
  );
  assert.deepEqual(calls, []);
}

async function testRejectsUnsupportedRuntimeNodes() {
  await assert.rejects(
    () => fitSelectedTextCardsToHeight(canvas([node('a')])),
    /不支持批量自适应高度/
  );
}

void (async () => {
  testToolbarButtonRequiresOneResizableCard();
  testToolbarButtonSupportsThumbnailCardsWithResizeHandler();
  testToolbarButtonHidesForEditingCards();
  await testFitsSelectedResizableCards();
  await testFitsSelectedThumbnailCards();
  await testSkipsEditingCardsDuringFit();
  await testRejectsMixedSelectionWithEditingCardsDuringFit();
  await testRejectsUnsupportedRuntimeNodes();
  console.log('canvas auto fit tests passed');
})();
