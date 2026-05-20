import * as assert from 'node:assert/strict';
import { OpenSameColorGroupWorkbenchCommand } from '../src/presentation/commands/ColorGroupCommands';
import { MergeToSidebarPreviewCommand } from '../src/presentation/commands/MergeCommands';
import { OpenPreviewWorkbenchCommand } from '../src/presentation/commands/QuickActionCommands';
import type CanvasLoomSettings from '../src/settings/ICanvasLoomSettings';
import type { CanvasNode } from '../src/types/canvas';

function textNode(id: string): CanvasNode {
  return {
    id,
    getData: () => ({
      id,
      type: 'text',
      text: id,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }),
  };
}

function settings(): CanvasLoomSettings {
  return {
    canvasCardDelimiter: '---',
    splitCardsPerRow: 5,
    sortPriority: 'xy',
    enableBadges: true,
    defaultSortMode: 'badge',
    mergeCleanupMode: 'delete-source',
    enablePerformanceMode: false,
    enablePerformanceDiagnostics: false,
    largeCanvasNodeThreshold: 80,
    badgeUpdateDebounceMs: 150,
  };
}

async function testOpenPreviewWorkbenchUsesDefaultSortMode() {
  const selection = [textNode('a')];
  let receivedOptions: Record<string, unknown> | undefined;
  const mergeService = {
    openWorkbench: async (_selection: CanvasNode[], _canvasFile: unknown, options: Record<string, unknown>) => {
      receivedOptions = options;
      return true;
    },
  };

  const command = new OpenPreviewWorkbenchCommand(mergeService as any, selection, null, settings());
  await command.execute();

  assert.deepEqual(receivedOptions, {
    order: 'badge',
    sortPriority: 'xy',
    cleanupMode: 'delete-source',
  });
}

async function testExpandedPreviewUsesDefaultSortMode() {
  const selection = [textNode('a')];
  let receivedOptions: Record<string, unknown> | undefined;
  const mergeService = {
    mergeToSidebar: async (_selection: CanvasNode[], _canvasFile: unknown, options: Record<string, unknown>) => {
      receivedOptions = options;
      return true;
    },
  };

  const command = new MergeToSidebarPreviewCommand(mergeService as any, selection, null, settings());
  await command.execute();

  assert.deepEqual(receivedOptions, {
    order: 'badge',
    sortPriority: 'xy',
    cleanupMode: 'delete-source',
  });
}

async function testSameColorWorkbenchUsesDefaultSortMode() {
  const selection = [textNode('a')];
  let receivedOptions: Record<string, unknown> | undefined;
  const colorGroupService = {
    hasTextCardSelection: () => true,
    getColorGroupFromSelection: () => ({
      matchedNodes: selection,
      scopeLabel: '同色卡片',
    }),
  };
  const mergeService = {
    openWorkbench: async (_selection: CanvasNode[], _canvasFile: unknown, options: Record<string, unknown>) => {
      receivedOptions = options;
      return true;
    },
  };

  const command = new OpenSameColorGroupWorkbenchCommand(
    colorGroupService as any,
    mergeService as any,
    selection,
    null,
    settings()
  );
  await command.execute();

  assert.deepEqual(receivedOptions, {
    order: 'badge',
    sortPriority: 'xy',
    previewExpanded: true,
    scopeLabel: '同色卡片',
    cleanupMode: 'delete-source',
  });
}

void (async () => {
  await testOpenPreviewWorkbenchUsesDefaultSortMode();
  await testExpandedPreviewUsesDefaultSortMode();
  await testSameColorWorkbenchUsesDefaultSortMode();
  console.log('workbench command settings tests passed');
})();
