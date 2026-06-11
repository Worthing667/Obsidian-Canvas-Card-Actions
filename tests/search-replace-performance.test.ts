import * as assert from 'node:assert/strict';
import { resolve } from 'node:path';

const moduleLoader = require("node:module") as {
  _resolveFilename(
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown
  ): string;
};
const resolveFilename = moduleLoader._resolveFilename;

moduleLoader._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown
): string {
  if (request === "obsidian") {
    return resolve("tests/stubs/obsidian.ts");
  }

  return resolveFilename.call(this, request, parent, isMain, options);
};

void (async () => {
const { SearchReplaceService } = await import('../src/services/SearchReplaceService');

function createAdapterWithReadCount() {
  let getDataCalls = 0;
  const data = {
    nodes: [
      { id: 'a', type: 'text', text: 'alpha beta alpha', x: 10, y: 20 },
      { id: 'b', type: 'text', text: 'beta', x: 0, y: 0 },
      { id: 'c', type: 'file', file: 'note.md' },
    ],
    edges: [],
  };

  return {
    adapter: {
      getData: () => {
        getDataCalls += 1;
        return data;
      },
      setData: async () => undefined,
      getSelectedNodes: () => [],
      replaceSelection: () => undefined,
      findNodeById: () => null,
      requestSave: async () => undefined,
      mutateData: async () => data,
      updateNode: async () => undefined,
      addNode: async () => undefined,
      addNodes: async () => undefined,
      removeNodes: async () => undefined,
    },
    getDataCallCount: () => getDataCalls,
  };
}

function testFindMatchesReadsCanvasDataOncePerQuery() {
  const { adapter, getDataCallCount } = createAdapterWithReadCount();
  const service = new SearchReplaceService(adapter as never);

  const result = service.findMatches({
    query: 'alpha',
    scope: 'canvas',
    caseSensitive: false,
    regex: false,
  });

  assert.equal(result.totalMatches, 2);
  assert.equal(getDataCallCount(), 1);
}

testFindMatchesReadsCanvasDataOncePerQuery();
console.log('search replace performance tests passed');
})();
