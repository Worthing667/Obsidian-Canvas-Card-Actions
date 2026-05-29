import * as assert from 'node:assert/strict';
import { CanvasPerformanceModeService } from '../src/services/CanvasPerformanceModeService';

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

function createServiceWithLeaves(leaves: unknown[]): CanvasPerformanceModeService {
  return new CanvasPerformanceModeService({
    workspace: {
      getLeavesOfType: (type: string) => type === 'canvas' ? leaves : [],
    },
  } as any);
}

function testCompactBadgeModeWhenPerformanceModeIsEnabledAtLowZoom() {
  const wrapperEl = document.createElement('div');
  const service = createServiceWithLeaves([
    { view: { canvas: { wrapperEl, tZoom: 0.5 } } },
  ]);

  service.syncCanvasWrappers(true);

  assert.equal(wrapperEl.dataset.canvasLoomBadgeMode, 'compact');
}

function testFullBadgeModeWhenPerformanceModeIsEnabledAtNormalZoom() {
  const wrapperEl = document.createElement('div');
  const service = createServiceWithLeaves([
    { view: { canvas: { wrapperEl, tZoom: 0.8 } } },
  ]);

  service.syncCanvasWrappers(true);

  assert.equal(wrapperEl.dataset.canvasLoomBadgeMode, 'full');
}

function testBadgeModeIsRemovedWhenPerformanceModeIsDisabled() {
  const wrapperEl = document.createElement('div');
  wrapperEl.dataset.canvasLoomBadgeMode = 'compact';
  const service = createServiceWithLeaves([
    { view: { canvas: { wrapperEl, tZoom: 0.5 } } },
  ]);

  service.syncCanvasWrappers(false);

  assert.equal(wrapperEl.dataset.canvasLoomBadgeMode, undefined);
}

function testSyncFallsBackToContainerCanvasWrapper() {
  const { rootEl, wrapperEl } = createCanvasRoot();
  const service = createServiceWithLeaves([
    { view: { containerEl: rootEl, canvas: { tZoom: 0.4 } } },
  ]);

  service.syncCanvasWrappers(true);

  assert.equal(wrapperEl.dataset.canvasLoomBadgeMode, 'compact');
}

testCompactBadgeModeWhenPerformanceModeIsEnabledAtLowZoom();
testFullBadgeModeWhenPerformanceModeIsEnabledAtNormalZoom();
testBadgeModeIsRemovedWhenPerformanceModeIsDisabled();
testSyncFallsBackToContainerCanvasWrapper();
console.log('canvas performance mode service tests passed');
