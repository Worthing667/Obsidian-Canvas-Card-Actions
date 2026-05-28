import * as assert from 'node:assert/strict';
import { CanvasLabelScaleService } from '../src/services/CanvasLabelScaleService';

class MockHTMLElement {
  dataset: Record<string, string> = {};
  private children: MockHTMLElement[] = [];
  private className = '';

  constructor(className = '') {
    this.className = className;
  }

  createDiv(options: { cls?: string } = {}): MockHTMLElement {
    const child = new MockHTMLElement(options.cls || '');
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): MockHTMLElement | null {
    if (selector !== '.canvas-wrapper') {
      return null;
    }

    return this.children.find((child) => child.className === 'canvas-wrapper') || null;
  }
}

(globalThis as any).HTMLElement = MockHTMLElement;

(globalThis as any).document = {
  createElement: () => new MockHTMLElement(),
};

function createCanvasRoot(): { rootEl: HTMLElement; wrapperEl: HTMLElement } {
  const rootEl = document.createElement('div') as HTMLElement;
  const wrapperEl = rootEl.createDiv({ cls: 'canvas-wrapper' });
  return { rootEl, wrapperEl };
}

function createServiceWithLeaves(leaves: unknown[]): CanvasLabelScaleService {
  return new CanvasLabelScaleService({
    workspace: {
      getLeavesOfType: (type: string) => type === 'canvas' ? leaves : [],
    },
  } as any);
}

function testSyncEnablesAdvancedCanvasFontZoomCompensationOnWrapper() {
  const wrapperEl = document.createElement('div');
  const service = createServiceWithLeaves([
    { view: { canvas: { wrapperEl } } },
  ]);

  service.syncCanvasWrappers(true);

  assert.equal(wrapperEl.dataset.disableFontSizeRelativeToZoom, 'true');
}

function testSyncRestoresDefaultFontZoomBehavior() {
  const wrapperEl = document.createElement('div');
  wrapperEl.dataset.disableFontSizeRelativeToZoom = 'true';
  const service = createServiceWithLeaves([
    { view: { canvas: { wrapperEl } } },
  ]);

  service.syncCanvasWrappers(false);

  assert.equal(wrapperEl.dataset.disableFontSizeRelativeToZoom, 'false');
}

function testSyncFallsBackToContainerCanvasWrapper() {
  const { rootEl, wrapperEl } = createCanvasRoot();
  const service = createServiceWithLeaves([
    { view: { containerEl: rootEl, canvas: {} } },
  ]);

  service.syncCanvasWrappers(true);

  assert.equal(wrapperEl.dataset.disableFontSizeRelativeToZoom, 'true');
}

testSyncEnablesAdvancedCanvasFontZoomCompensationOnWrapper();
testSyncRestoresDefaultFontZoomBehavior();
testSyncFallsBackToContainerCanvasWrapper();
console.log('canvas label scale service tests passed');
