import * as assert from 'node:assert/strict';
import { CardService } from '../src/services/CardService';
import type { ICanvasAdapter } from '../src/adapters/CanvasAdapter';
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
    findNodeById: () => null,
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

async function testSplitWrapsAfterSixCardsIncludingOriginal() {
  const source: CanvasNodeData = {
    id: 'source',
    type: 'text',
    text: ['part-1', '---', 'part-2', '---', 'part-3', '---', 'part-4', '---', 'part-5', '---', 'part-6', '---', 'part-7', '---', 'part-8'].join('\n'),
    x: 100,
    y: 200,
    width: 120,
    height: 80,
  };
  const data: CanvasData = { nodes: [source], edges: [] };
  const adapter = adapterFor(data);
  const service = new CardService(adapter, 20);

  await service.splitCard(textNode(source), '---');

  assert.equal(adapter.setDataCalls, 1);
  assert.equal(adapter.saveCalls, 1);
  assert.equal(data.nodes.length, 8);
  assert.deepEqual(data.nodes.map((node) => ({ text: node.text, x: node.x, y: node.y })), [
    { text: 'part-1', x: 100, y: 200 },
    { text: 'part-2', x: 240, y: 200 },
    { text: 'part-3', x: 380, y: 200 },
    { text: 'part-4', x: 520, y: 200 },
    { text: 'part-5', x: 660, y: 200 },
    { text: 'part-6', x: 800, y: 200 },
    { text: 'part-7', x: 100, y: 300 },
    { text: 'part-8', x: 240, y: 300 },
  ]);
}

void (async () => {
  await testSplitWrapsAfterSixCardsIncludingOriginal();
  console.log('card service split layout tests passed');
})();
