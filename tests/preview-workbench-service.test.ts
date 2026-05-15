import * as assert from 'node:assert/strict';
import { PreviewWorkbenchService } from '../src/services/PreviewWorkbenchService';
import type { CardSnapshot } from '../src/types/WorkbenchState';

function card(id: string, x: number, y: number): CardSnapshot {
  return {
    id,
    text: id,
    x,
    y,
    width: 100,
    height: 50,
  };
}

function ids(cards: CardSnapshot[]): string[] {
  return cards.map((item) => item.id);
}

function testPositionModeFollowsLatestSortPriorityUntilManuallyAdjusted() {
  const service = new PreviewWorkbenchService();
  const state = service.createState({
    canvasFilePath: 'test.canvas',
    canvasFileBasename: 'test',
    selectionSnapshot: [
      card('top-right', 100, 0),
      card('bottom-left', 0, 100),
      card('top-left', 0, 0),
    ],
    defaultSortMode: 'position',
    sortPriority: 'yx',
  });

  assert.deepEqual(ids(service.getOrderedCards(state, 'yx')), [
    'top-left',
    'bottom-left',
    'top-right',
  ]);
  assert.deepEqual(ids(service.getOrderedCards(state, 'xy')), [
    'top-left',
    'top-right',
    'bottom-left',
  ]);
}

function testManualAdjustmentKeepsExplicitOrderAcrossSortPriorityChanges() {
  const service = new PreviewWorkbenchService();
  const state = service.createState({
    canvasFilePath: 'test.canvas',
    canvasFileBasename: 'test',
    selectionSnapshot: [
      card('top-right', 100, 0),
      card('bottom-left', 0, 100),
      card('top-left', 0, 0),
    ],
    defaultSortMode: 'position',
    sortPriority: 'yx',
  });

  const adjusted = service.reorderManual(state, 0, 2, 'yx');

  assert.deepEqual(ids(service.getOrderedCards(adjusted, 'xy')), [
    'bottom-left',
    'top-right',
    'top-left',
  ]);
}

testPositionModeFollowsLatestSortPriorityUntilManuallyAdjusted();
testManualAdjustmentKeepsExplicitOrderAcrossSortPriorityChanges();
console.log('preview workbench service tests passed');
