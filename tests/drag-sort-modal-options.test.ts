import * as assert from 'node:assert/strict';
import { DragSortModal } from '../src/presentation/modals/DragSortModal';

function testDragSortModalAcceptsSemanticModeAndActionKeys() {
  const modal = new DragSortModal({} as never, [], {
    mode: 'merge',
    actions: [
      {
        textKey: 'modal.dragSort.addAsCard',
        cls: 'drag-sort-btn drag-sort-btn-primary',
        onClick: async () => undefined,
      },
    ],
  });

  assert.ok(modal);
}

void (() => {
  testDragSortModalAcceptsSemanticModeAndActionKeys();
  console.log('drag sort modal options tests passed');
})();
