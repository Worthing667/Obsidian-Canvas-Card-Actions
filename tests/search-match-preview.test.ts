import * as assert from 'node:assert/strict';
import { buildSearchMatchPreviewParts } from '../src/utils/SearchMatchPreview';

function testBuildPreviewPartsMarksCurrentMatchWithContext() {
  const parts = buildSearchMatchPreviewParts(
    'prefix alpha suffix',
    { start: 7, end: 12, value: 'alpha' },
    { before: 4, after: 4 }
  );

  assert.deepEqual(parts, [
    { kind: 'ellipsis', text: '...' },
    { kind: 'context', text: 'fix ' },
    { kind: 'match', text: 'alpha' },
    { kind: 'context', text: ' suf' },
    { kind: 'ellipsis', text: '...' },
  ]);
}

testBuildPreviewPartsMarksCurrentMatchWithContext();
console.log('search match preview tests passed');
