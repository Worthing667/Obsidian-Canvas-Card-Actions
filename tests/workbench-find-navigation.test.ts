import * as assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { CanvasFindActiveMatchHighlighter } from '../src/utils/CanvasFindHighlight';

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

class MockClassList {
  private readonly values = new Set<string>();

  constructor(className = '') {
    className.split(/\s+/).filter(Boolean).forEach((value) => this.values.add(value));
  }

  add(value: string): void {
    this.values.add(value);
  }

  remove(value: string): void {
    this.values.delete(value);
  }

  contains(value: string): boolean {
    return this.values.has(value);
  }
}

class MockElement {
  classList: MockClassList;
  children: MockElement[] = [];
  dataset: Record<string, string> = {};
  textContent = '';
  title = '';
  ownerDocument = {
    createElement: () => new MockElement(),
  };
  scrollIntoViewCalls = 0;
  offsetWidth = 100;

  constructor(public className = '') {
    this.classList = new MockClassList(className);
  }

  createDiv(options: { cls?: string; text?: string } = {}): MockElement {
    const element = new MockElement(options.cls || '');
    element.textContent = options.text || '';
    this.children.push(element);
    return element;
  }

  createEl(_tag: string, options: { cls?: string; text?: string } = {}): MockElement {
    return this.createDiv(options);
  }

  createSpan(options: { cls?: string; text?: string } = {}): MockElement {
    return this.createDiv(options);
  }

  appendChild(child: MockElement): void {
    this.children.push(child);
  }

  setText(text: string): void {
    this.textContent = text;
  }

  empty(): void {
    this.children = [];
  }

  addEventListener(): void {}

  querySelector(): MockElement | null {
    return null;
  }

  scrollIntoView(): void {
    this.scrollIntoViewCalls += 1;
  }
}

(globalThis as any).window = {
  setTimeout: () => 1,
  clearTimeout: () => undefined,
};
(globalThis as any).HTMLElement = MockElement;

function createWorkbenchView(): any {
  const MergeWorkbenchView = workbenchViewConstructor;
  const view = Object.create(MergeWorkbenchView.prototype) as any;
  view.findResultListEl = new MockElement('canvas-loom-fr-results');
  view.findQuery = 'alpha';
  view.findCurrentFlatIndex = 1;
  view.translate = (_key: string) => '';
  return view;
}

let workbenchViewConstructor: typeof import('../src/presentation/views/MergeWorkbenchView').MergeWorkbenchView;

void (async () => {
workbenchViewConstructor = (await import('../src/presentation/views/MergeWorkbenchView')).MergeWorkbenchView;

function testActiveWorkbenchResultScrollsIntoViewAfterRender() {
  const view = createWorkbenchView();
  const matches = [
    {
      card: { nodeId: 'a', text: 'alpha', x: 0, y: 0, ranges: [{ start: 0, end: 5, value: 'alpha' }] },
      matchIndex: 0,
      flatIndex: 0,
    },
    {
      card: { nodeId: 'b', text: 'beta alpha', x: 10, y: 20, ranges: [{ start: 5, end: 10, value: 'alpha' }] },
      matchIndex: 0,
      flatIndex: 1,
    },
  ];

  view.renderFindResultList(matches);

  assert.equal(view.findResultListEl.children[1].scrollIntoViewCalls, 1);
}

function testCanvasFindHighlighterMarksActiveCard() {
  const nodeEl = new MockElement('canvas-node');
  const canvas = {
    nodes: new Map([
      ['a', { nodeEl }],
    ]),
  };
  const highlighter = new CanvasFindActiveMatchHighlighter();

  highlighter.apply(canvas as never, {
    card: { nodeId: 'a', text: 'alpha', x: 0, y: 0, ranges: [{ start: 0, end: 5, value: '' }] },
    matchIndex: 0,
  });

  assert.equal(nodeEl.classList.contains('canvas-loom-find-active-card'), true);
  assert.equal(nodeEl.classList.contains('canvas-loom-find-pulse'), true);
}

function testWorkbenchCurrentMatchHighlightsLocatedCard() {
  const calls: string[] = [];
  const view = createWorkbenchView();
  view.findCurrentFlatIndex = 0;
  view.findResults = [
    {
      nodeId: 'a',
      text: 'alpha',
      x: 0,
      y: 0,
      ranges: [{ start: 0, end: 5, value: 'alpha' }],
    },
  ];
  view.context = {
    findReplace: {
      service: {
        isCanvasEditing: () => false,
        selectNode: (nodeId: string) => {
          calls.push(`select:${nodeId}`);
          return true;
        },
        locateNode: (nodeId: string) => {
          calls.push(`locate:${nodeId}`);
          return true;
        },
        highlightSearchMatch: (match: { card: { nodeId: string } }) => {
          calls.push(`highlight:${match.card.nodeId}`);
          return true;
        },
      },
    },
  };
  view.renderFindResults = () => undefined;

  view.setCurrentFindMatch(0, true);

  assert.deepEqual(calls, ['select:a', 'locate:a', 'highlight:a']);
}

testActiveWorkbenchResultScrollsIntoViewAfterRender();
testCanvasFindHighlighterMarksActiveCard();
testWorkbenchCurrentMatchHighlightsLocatedCard();
console.log('workbench find navigation tests passed');
})();
