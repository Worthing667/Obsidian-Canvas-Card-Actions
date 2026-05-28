import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function testAdvancedCanvasFontZoomCompensationCssExists() {
  const styles = readFileSync('styles.css', 'utf8');

  assert.match(
    styles,
    /\.canvas-wrapper\[data-disable-font-size-relative-to-zoom=['"]true['"]\]\s+\.canvas-zoom-container\s*\{[^}]*--zoom-multiplier:\s*1\s*;/s
  );

  assert.doesNotMatch(
    styles,
    /--zoom-multiplier:\s*1\s*!important;/s
  );
}

testAdvancedCanvasFontZoomCompensationCssExists();
console.log('canvas label scale css tests passed');
