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

class MockHTMLElement {
  className = '';
  children: MockHTMLElement[] = [];

  constructor(className = '') {
    this.className = className;
  }

  querySelector(selector: string): MockHTMLElement | null {
    const className = selector.replace('.', '');
    return this.children.find((child) => child.className === className) || null;
  }

  querySelectorAll(): MockHTMLElement[] {
    return [];
  }

  appendChild(child: MockHTMLElement): void {
    this.children.push(child);
  }

  contains(target: MockHTMLElement): boolean {
    return target === this || this.children.includes(target);
  }
}

class MockMutationObserver {
  static observedTargets: unknown[] = [];

  constructor(_callback: MutationCallback) {}

  observe(target: Node): void {
    MockMutationObserver.observedTargets.push(target);
  }

  disconnect(): void {}
}

(globalThis as any).HTMLElement = MockHTMLElement;
(globalThis as any).Node = MockHTMLElement;
(globalThis as any).MutationObserver = MockMutationObserver;
(globalThis as any).ResizeObserver = class {
  observe(): void {}
  disconnect(): void {}
};
(globalThis as any).window = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

void (async () => {
const { CanvasGlobalFindReplaceToolbarService } = await import('../src/services/CanvasGlobalFindReplaceToolbarService');

function createService(): InstanceType<typeof CanvasGlobalFindReplaceToolbarService> {
  return new CanvasGlobalFindReplaceToolbarService({
    workspace: {
      onLayoutReady: () => undefined,
      on: () => ({}),
      offref: () => undefined,
      getLeavesOfType: () => [],
      getActiveViewOfType: () => null,
    },
  } as never);
}

function testControlsObserverTracksCanvasRootForControlReplacement() {
  const service = createService() as any;
  const rootEl = new MockHTMLElement('canvas-root');
  const controlsEl = new MockHTMLElement('canvas-controls');
  rootEl.appendChild(controlsEl);

  service.observeCanvasControls(rootEl);

  assert.equal(MockMutationObserver.observedTargets[0], rootEl);
}

function testFlatMatchesAreCachedUntilResultsChange() {
  const service = createService() as any;
  service.results = [
    {
      nodeId: 'a',
      text: 'alpha alpha',
      x: 0,
      y: 0,
      ranges: [
        { start: 0, end: 5, value: 'alpha' },
        { start: 6, end: 11, value: 'alpha' },
      ],
    },
  ];

  const first = service.getFlatMatches();
  const second = service.getFlatMatches();

  assert.equal(first, second);
  assert.equal(first.length, 2);
}

testControlsObserverTracksCanvasRootForControlReplacement();
testFlatMatchesAreCachedUntilResultsChange();
console.log('canvas global find replace performance tests passed');
})();
