import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const styles = readFileSync(resolve('styles.css'), 'utf8');

function getRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function testWorkbenchButtonsExposeInteractionFeedback(): void {
  const enabledRule = getRule('.canvas-loom-workbench button:not(:disabled)');
  assert.match(enabledRule, /cursor:\s*pointer/);
  assert.match(enabledRule, /transition:/);

  const pressedRule = getRule('.canvas-loom-workbench button:active:not(:disabled)');
  assert.match(pressedRule, /transform:\s*translateY\(1px\)/);

  const focusRule = getRule('.canvas-loom-workbench button:focus-visible');
  assert.match(focusRule, /outline:\s*2px solid var\(--interactive-accent\)/);

  const disabledRule = getRule('.canvas-loom-workbench button:disabled');
  assert.match(disabledRule, /cursor:\s*not-allowed/);
}

function testWorkbenchButtonGroupsExposeHoverFeedback(): void {
  const tabHoverRule = getRule('.canvas-loom-workbench-panel-tabs button:hover:not(:disabled):not(.is-active)');
  assert.match(tabHoverRule, /background:\s*var\(--background-modifier-hover\)/);

  const previewHoverRule = getRule('.canvas-loom-workbench-render-action button:hover:not(:disabled)');
  assert.match(previewHoverRule, /background:\s*var\(--interactive-accent-hover\)/);

  const actionHoverRule = getRule('.canvas-loom-workbench-actions button:hover:not(:disabled)');
  assert.match(actionHoverRule, /background:\s*var\(--background-modifier-hover\)/);
}

testWorkbenchButtonsExposeInteractionFeedback();
testWorkbenchButtonGroupsExposeHoverFeedback();
console.log('workbench button feedback tests passed');
