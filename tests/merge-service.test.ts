import * as assert from 'node:assert/strict';
import { MergeService } from '../src/services/MergeService';
import type { ICanvasAdapter } from '../src/adapters/CanvasAdapter';
import type { IContentService, MergedContentResult } from '../src/services/ContentService';
import type { CardSnapshot } from '../src/types/WorkbenchState';
import type { CanvasData, CanvasNode, CanvasNodeData } from '../src/types/canvas';

function textNode(data: CanvasNodeData): CanvasNode {
  return {
    id: data.id,
    getData: () => data,
  };
}

function adapterFor(data: CanvasData): ICanvasAdapter & { setDataCalls: number; saveCalls: number } {
  const adapter: ICanvasAdapter & { setDataCalls: number; saveCalls: number } = {
    setDataCalls: 0,
    saveCalls: 0,
    getData: () => data,
    setData: async (next) => {
      data.nodes = next.nodes;
      data.edges = next.edges;
      Object.keys(next).forEach((key) => {
        (data as Record<string, unknown>)[key] = next[key];
      });
      adapter.setDataCalls += 1;
    },
    getSelectedNodes: () => [],
    replaceSelection: () => undefined,
    findNodeById: (id) => {
      const nodeData = data.nodes.find((node) => node.id === id);
      return nodeData ? textNode(nodeData) : null;
    },
    requestSave: async () => {
      adapter.saveCalls += 1;
    },
    mutateData: async (mutator) => {
      const next = {
        ...data,
        nodes: [...data.nodes],
        edges: [...data.edges],
      };
      mutator(next);
      await adapter.setData(next);
      return next;
    },
    updateNode: async () => undefined,
    addNode: async () => undefined,
    addNodes: async () => undefined,
    removeNodes: async () => undefined,
  };

  return adapter;
}

function snapshots(): CardSnapshot[] {
  return [
    {
      id: 'a',
      text: 'first',
      x: 10,
      y: 20,
      width: 320,
      height: 120,
    },
    {
      id: 'b',
      text: 'second',
      x: 10,
      y: 180,
      width: 280,
      height: 80,
    },
  ];
}

function contentServiceFor(orderedSnapshots: CardSnapshot[]): IContentService {
  const mergedContent: MergedContentResult = {
    content: orderedSnapshots.map((snapshot) => snapshot.text).join('\n\n'),
    count: orderedSnapshots.length,
  };

  return {
    copyContentByPosition: async () => undefined,
    copyContentByBadgeOrder: async () => undefined,
    copySingleCardContent: async () => undefined,
    copyMergedContent: async () => true,
    buildMergedContent: async () => mergedContent,
    createSelectionSnapshot: async () => orderedSnapshots,
    getOrderedCards: async () => orderedSnapshots,
    formatBadgedCardsContent: () => '',
  };
}

async function testMergedCanvasCardHeightUsesAllSourceHeights() {
  const sourceSnapshots = snapshots();
  const selection = sourceSnapshots.map((snapshot) => textNode({
    id: snapshot.id,
    type: 'text',
    text: snapshot.text,
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
  }));
  const data: CanvasData = {
    nodes: selection.map((node) => node.getData()),
    edges: [],
  };
  const adapter = adapterFor(data);
  const service = new MergeService(
    {} as any,
    adapter,
    contentServiceFor(sourceSnapshots),
    { createMergedDocument: async () => { throw new Error('not used'); } } as any
  );

  const success = await service.mergeToCanvasCard(selection);

  assert.equal(success, true);
  assert.equal(adapter.setDataCalls, 1);
  assert.equal(adapter.saveCalls, 1);
  assert.equal(data.nodes.length, 3);

  const mergedNode = data.nodes[2];
  assert.equal(mergedNode.x, 10);
  assert.equal(mergedNode.y, 20);
  assert.equal(mergedNode.width, 320);
  assert.equal(mergedNode.height, 200);
}

void (async () => {
  await testMergedCanvasCardHeightUsesAllSourceHeights();
  console.log('merge service tests passed');
})();
