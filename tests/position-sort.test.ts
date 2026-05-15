import * as assert from 'node:assert/strict';
import { PositionSortStrategy } from '../src/domain/strategies';
import type { SortableCard } from '../src/domain/strategies';

interface TestCard extends SortableCard {
  id: string;
}

function card(id: string, x: number, y: number): TestCard {
  return { id, text: id, x, y };
}

function ids(cards: TestCard[]): string[] {
  return cards.map((item) => item.id);
}

function testVerticalPriorityReadsDownEachColumnBeforeMovingRight() {
  const sorter = new PositionSortStrategy('yx');
  const cards = [
    card('1', -4426, 6058),
    card('3', -3973, 6058),
    card('4', -3368, 6058),
    card('2', -4426, 6427),
  ];

  assert.deepEqual(ids(sorter.sort(cards)), ['1', '2', '3', '4']);
}

function testHorizontalPriorityReadsAcrossEachRowBeforeMovingDown() {
  const sorter = new PositionSortStrategy('xy');
  const cards = [
    card('1', -4426, 6058),
    card('3', -3973, 6058),
    card('4', -3368, 6058),
    card('2', -4426, 6427),
  ];

  assert.deepEqual(ids(sorter.sort(cards)), ['1', '3', '4', '2']);
}

testVerticalPriorityReadsDownEachColumnBeforeMovingRight();
testHorizontalPriorityReadsAcrossEachRowBeforeMovingDown();
console.log('position sort tests passed');
