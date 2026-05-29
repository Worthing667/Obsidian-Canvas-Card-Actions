import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function testAdvancedCanvasFontZoomCompensationCssExists() {
  const styles = readFileSync('styles.css', 'utf8');

  assert.match(
    styles,
    /\.canvas-wrapper\[data-disable-font-size-relative-to-zoom=['"]true['"]\]\s*\{[^}]*--zoom-multiplier:\s*1\s*!important;/s
  );

  assert.doesNotMatch(
    styles,
    /\.canvas-wrapper\[data-disable-font-size-relative-to-zoom=['"]true['"]\]\s+\.canvas-zoom-container/s
  );
}

function testPerformanceModeBadgeRenderingCssExists() {
  const styles = readFileSync('styles.css', 'utf8');

  assert.match(
    styles,
    /\.canvas-loom-performance-mode\s+\.canvas-node\s+\.canvas-node-content\s*\{[^}]*backface-visibility:\s*visible;/s
  );

  assert.match(
    styles,
    /\.canvas-loom-performance-mode\s+\.canvas-node\s+\.canvas-node-content\[data-badge\]::after\s*\{[^}]*animation:\s*none;[^}]*box-shadow:\s*none;/s
  );

  assert.match(
    styles,
    /\.canvas-loom-performance-mode\s+\.canvas-wrapper\[data-canvas-loom-badge-mode=['"]compact['"]\]\s+\.canvas-node\s+\.canvas-node-content\[data-badge\]::after\s*\{[^}]*content:\s*[""]{2};[^}]*min-width:\s*8px;[^}]*height:\s*8px;/s
  );
}

testAdvancedCanvasFontZoomCompensationCssExists();
testPerformanceModeBadgeRenderingCssExists();
console.log('canvas label scale css tests passed');
