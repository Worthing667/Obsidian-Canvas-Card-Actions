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
const { BadgeService } = await import('../src/services/BadgeService');

function createBadgeService(): InstanceType<typeof BadgeService> {
  return new BadgeService({
    getData: () => ({ nodes: [], edges: [] }),
    setData: async () => undefined,
    getSelectedNodes: () => [],
    replaceSelection: () => undefined,
    findNodeById: () => null,
    requestSave: async () => undefined,
    mutateData: async () => ({ nodes: [], edges: [] }),
    updateNode: async () => undefined,
    addNode: async () => undefined,
    addNodes: async () => undefined,
    removeNodes: async () => undefined,
  }, () => true);
}

function testDisposeCancelsPendingBadgeRefresh() {
  const animationFrames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, TimerHandler>();
  let nextId = 1;
  let loadCalls = 0;

  (globalThis as any).window = {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = nextId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      animationFrames.delete(id);
    },
    setTimeout: (callback: TimerHandler) => {
      const id = nextId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  };

  const service = createBadgeService();
  service.loadCanvasBadges = () => {
    loadCalls += 1;
    return Promise.resolve();
  };

  (service as any).refreshBadgeDomSoon();
  (service as any).dispose();

  Array.from(animationFrames.values()).forEach((callback) => callback(0));
  Array.from(timers.values()).forEach((callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });

  assert.equal(loadCalls, 0);
}

testDisposeCancelsPendingBadgeRefresh();
console.log('badge service dispose tests passed');
})();
