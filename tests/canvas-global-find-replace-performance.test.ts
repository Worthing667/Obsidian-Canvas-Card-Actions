import * as assert from 'node:assert/strict';
import { CanvasGlobalFindReplaceToolbarService } from '../src/services/CanvasGlobalFindReplaceToolbarService';

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

function createService(): CanvasGlobalFindReplaceToolbarService {
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

function testControlsObserverPrefersCanvasControlsElement() {
  const service = createService() as any;
  const rootEl = new MockHTMLElement('canvas-root');
  const controlsEl = new MockHTMLElement('canvas-controls');
  rootEl.appendChild(controlsEl);

  service.observeCanvasControls(rootEl);

  assert.equal(MockMutationObserver.observedTargets[0], controlsEl);
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

testControlsObserverPrefersCanvasControlsElement();
testFlatMatchesAreCachedUntilResultsChange();
console.log('canvas global find replace performance tests passed');
