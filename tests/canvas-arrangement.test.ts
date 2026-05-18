import * as assert from 'node:assert/strict';
import {
  ArrangeSessionPreferenceStore,
  arrangeSelectedTextCards,
  shouldShowArrangementToolbarButton
} from '../src/services/CanvasArrangementService';

function node(id: string, x: number, y: number, width = 100, height = 50, type = 'text') {
  return { id, getData: () => ({ id, type, x, y, width, height, text: type === 'text' ? id : undefined }) };
}

async function testArrangesLiveSelectionHorizontally() {
  const a = node('a', 10, 20, 100, 50);
  const b = node('b', 80, 0, 70, 40);
  const c = node('c', 5, 120, 30, 30);
  const data = { nodes: [a.getData(), b.getData(), c.getData()], edges: [] };
  let saved = 0;
  let setDataCalls = 0;
  const canvas = {
    selection: new Set([a, b, c]),
    getData: () => data,
    setData: (next: typeof data) => { Object.assign(data, next); setDataCalls += 1; },
    requestSave: () => { saved += 1; }
  };

  const result = await arrangeSelectedTextCards(canvas, { direction: 'horizontal', spacing: 20, sortPriority: 'yx' });

  assert.equal(result.count, 3);
  assert.equal(setDataCalls, 1);
  assert.equal(saved, 1);
  assert.deepEqual(data.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })), [
    { id: 'a', x: 10, y: 20 },
    { id: 'b', x: 180, y: 0 },
    { id: 'c', x: 130, y: 120 },
  ]);
}

async function testArrangesLiveSelectionVerticallyWithoutChangingX() {
  const a = node('a', 10, 20, 100, 50);
  const b = node('b', 80, 0, 70, 40);
  const c = node('c', 5, 120, 30, 30);
  const data = { nodes: [a.getData(), b.getData(), c.getData()], edges: [] };
  const canvas = {
    selection: new Set([a, b, c]),
    getData: () => data,
    setData: (next: typeof data) => { Object.assign(data, next); },
    requestSave: () => undefined
  };

  await arrangeSelectedTextCards(canvas, { direction: 'vertical', spacing: 20, sortPriority: 'yx' });

  assert.deepEqual(data.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })), [
    { id: 'a', x: 10, y: 20 },
    { id: 'b', x: 80, y: 140 },
    { id: 'c', x: 5, y: 90 },
  ]);
}

async function testUsesConfiguredPositionSortPriority() {
  const a = node('a', 20, 20, 100, 50);
  const b = node('b', 100, 0, 70, 40);
  const c = node('c', 0, 120, 30, 30);
  const data = { nodes: [a.getData(), b.getData(), c.getData()], edges: [] };
  const canvas = {
    selection: new Set([a, b, c]),
    getData: () => data,
    setData: (next: typeof data) => { Object.assign(data, next); },
    requestSave: () => undefined
  };

  await arrangeSelectedTextCards(canvas, { direction: 'horizontal', spacing: 20, sortPriority: 'xy' });

  assert.deepEqual(data.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })), [
    { id: 'a', x: 190, y: 20 },
    { id: 'b', x: 100, y: 0 },
    { id: 'c', x: 310, y: 120 },
  ]);
}

function testToolbarButtonRequiresAtLeastTwoTextCards() {
  const textA = node('a', 0, 0);
  const textB = node('b', 0, 0);
  const fileNode = node('file', 0, 0, 100, 50, 'file');

  assert.equal(shouldShowArrangementToolbarButton(new Set([textA])), false);
  assert.equal(shouldShowArrangementToolbarButton(new Set([textA, fileNode])), false);
  assert.equal(shouldShowArrangementToolbarButton(new Set([textA, textB, fileNode])), true);
}

function testArrangeSessionPreferenceUsesCurrentSettingsUntilRemembered() {
  let currentSortPriority: 'yx' | 'xy' = 'yx';
  const store = new ArrangeSessionPreferenceStore(() => currentSortPriority);

  assert.deepEqual(store.get(), {
    direction: 'horizontal',
    sortPriority: 'yx',
    spacing: 20,
  });

  currentSortPriority = 'xy';

  assert.deepEqual(store.get(), {
    direction: 'horizontal',
    sortPriority: 'xy',
    spacing: 20,
  });
}

function testArrangeSessionPreferenceRemembersLastAppliedChoice() {
  let currentSortPriority: 'yx' | 'xy' = 'yx';
  const store = new ArrangeSessionPreferenceStore(() => currentSortPriority);

  store.remember({
    direction: 'vertical',
    sortPriority: 'xy',
    spacing: 48,
  });
  currentSortPriority = 'yx';

  assert.deepEqual(store.get(), {
    direction: 'vertical',
    sortPriority: 'xy',
    spacing: 48,
  });
}

void (async () => {
  await testArrangesLiveSelectionHorizontally();
  await testArrangesLiveSelectionVerticallyWithoutChangingX();
  await testUsesConfiguredPositionSortPriority();
  testToolbarButtonRequiresAtLeastTwoTextCards();
  testArrangeSessionPreferenceUsesCurrentSettingsUntilRemembered();
  testArrangeSessionPreferenceRemembersLastAppliedChoice();
  console.log('canvas arrangement tests passed');
})();
