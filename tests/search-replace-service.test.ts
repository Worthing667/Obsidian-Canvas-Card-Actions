import * as assert from 'node:assert/strict';
import { SearchReplaceService } from '../src/services/SearchReplaceService';
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

function sampleData(): CanvasData {
  return {
    nodes: [
      {
        id: 'a',
        type: 'text',
        text: 'Alpha beta alpha',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        badge: '1',
      },
      {
        id: 'b',
        type: 'text',
        text: 'beta gamma',
        x: 100,
        y: 0,
        width: 100,
        height: 80,
      },
      {
        id: 'file-node',
        type: 'file',
        file: 'note.md',
        x: 200,
        y: 0,
        width: 100,
        height: 80,
      },
    ],
    edges: [
      {
        id: 'edge',
        fromNode: 'a',
        fromSide: 'right',
        toNode: 'b',
        toSide: 'left',
      },
    ],
  };
}

function testFindAcrossCanvasTextCardsOnly() {
  const service = new SearchReplaceService(adapterFor(sampleData()));

  const result = service.findMatches({
    query: 'alpha',
    scope: 'canvas',
    caseSensitive: false,
    regex: false,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.totalCards, 2);
  assert.equal(result.totalMatches, 2);
  assert.deepEqual(result.cards.map((card) => card.nodeId), ['a']);
}

function testSelectionScopeOnlySearchesCapturedSelection() {
  const service = new SearchReplaceService(adapterFor(sampleData()));

  const result = service.findMatches({
    query: 'beta',
    scope: 'selection',
    selectedNodeIds: new Set(['b']),
    caseSensitive: false,
    regex: false,
  });

  assert.equal(result.totalCards, 1);
  assert.equal(result.totalMatches, 1);
  assert.deepEqual(result.cards.map((card) => card.nodeId), ['b']);
}

function testTextCardSnapshotsUseOptionalNodeFilter() {
  const service = new SearchReplaceService(adapterFor(sampleData()));

  const snapshots = service.getTextCardSnapshots(new Set(['a', 'file-node']));

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].id, 'a');
  assert.equal(snapshots[0].text, 'Alpha beta alpha');
  assert.equal(snapshots[0].badge, '1');
}

async function testReplaceAllUsesLiteralReplacementInPlainMode() {
  const data = sampleData();
  const adapter = adapterFor(data);
  const service = new SearchReplaceService(adapter);

  const result = await service.replaceAll({
    query: 'beta',
    replacement: '$1',
    scope: 'canvas',
    caseSensitive: true,
    regex: false,
  });

  assert.equal(result.matchedCount, 2);
  assert.equal(result.changedCount, 2);
  assert.equal(result.changedNodeCount, 2);
  assert.equal(adapter.setDataCalls, 1);
  assert.equal(adapter.saveCalls, 1);
  assert.equal(data.nodes[0].text, 'Alpha $1 alpha');
  assert.equal(data.nodes[1].text, '$1 gamma');
  assert.equal(data.edges.length, 1);
}

async function testReplaceCurrentOnlyUpdatesOneMatch() {
  const data = sampleData();
  const adapter = adapterFor(data);
  const service = new SearchReplaceService(adapter);

  const result = await service.replaceCurrent({
    query: 'alpha',
    replacement: 'delta',
    scope: 'canvas',
    caseSensitive: false,
    regex: false,
  }, {
    nodeId: 'a',
    matchIndex: 1,
  });

  assert.equal(result.matchedCount, 1);
  assert.equal(result.changedCount, 1);
  assert.equal(result.changedNodeCount, 1);
  assert.equal(data.nodes[0].text, 'Alpha beta delta');
  assert.equal(data.nodes[1].text, 'beta gamma');
}

function testInvalidRegexReturnsErrorWithoutThrowing() {
  const service = new SearchReplaceService(adapterFor(sampleData()));

  const result = service.findMatches({
    query: '[',
    scope: 'canvas',
    caseSensitive: false,
    regex: true,
  });

  assert.ok(result.error);
  assert.equal(result.totalMatches, 0);
}

function testLocateNodeDelegatesToCanvasAdapterWhenAvailable() {
  const adapter = adapterFor(sampleData()) as ReturnType<typeof adapterFor> & {
    locatedNodeId: string | null;
    locateNode: (id: string) => boolean;
  };
  adapter.locatedNodeId = null;
  adapter.locateNode = (id) => {
    adapter.locatedNodeId = id;
    return true;
  };
  const service = new SearchReplaceService(adapter);

  assert.equal(service.locateNode('a'), true);
  assert.equal(adapter.locatedNodeId, 'a');
}

void (async () => {
  testFindAcrossCanvasTextCardsOnly();
  testSelectionScopeOnlySearchesCapturedSelection();
  testTextCardSnapshotsUseOptionalNodeFilter();
  await testReplaceAllUsesLiteralReplacementInPlainMode();
  await testReplaceCurrentOnlyUpdatesOneMatch();
  testInvalidRegexReturnsErrorWithoutThrowing();
  testLocateNodeDelegatesToCanvasAdapterWhenAvailable();
  console.log('search replace service tests passed');
})();
