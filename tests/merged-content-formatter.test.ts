import * as assert from 'node:assert/strict';
import { formatMergedCardsContent, resolveCardJoiner } from '../src/services/MergedContentFormatter';

function testDefaultJoinerKeepsBlankLineOnly() {
  assert.equal(resolveCardJoiner(null), '\n\n');
  assert.equal(
    formatMergedCardsContent([{ text: 'first' }, { text: 'second' }]),
    'first\n\nsecond'
  );
}

function testCardSeparatorIsRenderedAsIndependentLine() {
  assert.equal(resolveCardJoiner('---'), '\n\n---\n\n');
  assert.equal(
    formatMergedCardsContent([{ text: 'first' }, { text: 'second' }], { cardSeparator: '---' }),
    'first\n\n---\n\nsecond'
  );
}

function testBadgePrefixAndSeparatorCanBeCombined() {
  assert.equal(
    formatMergedCardsContent(
      [
        { text: 'first', badge: 'A1' },
        { text: 'second', badge: 'A2' },
      ],
      {
        includeBadgePrefix: true,
        cardSeparator: '---',
      }
    ),
    '[A1] first\n\n---\n\n[A2] second'
  );
}

testDefaultJoinerKeepsBlankLineOnly();
testCardSeparatorIsRenderedAsIndependentLine();
testBadgePrefixAndSeparatorCanBeCombined();
console.log('merged content formatter tests passed');
