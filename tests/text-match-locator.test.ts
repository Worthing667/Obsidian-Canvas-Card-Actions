import * as assert from 'node:assert/strict';
import { findNthTextMatchIndex } from '../src/utils/TextMatchLocator';

function testFindNthTextMatchIndexLocatesRepeatedMatches() {
  assert.equal(findNthTextMatchIndex('name: a\nname: b\nname: c', 'name', 0), 0);
  assert.equal(findNthTextMatchIndex('name: a\nname: b\nname: c', 'name', 1), 8);
  assert.equal(findNthTextMatchIndex('name: a\nname: b\nname: c', 'name', 2), 16);
}

function testFindNthTextMatchIndexReturnsMinusOneWhenMissing() {
  assert.equal(findNthTextMatchIndex('name: a', 'name', 1), -1);
  assert.equal(findNthTextMatchIndex('name: a', '', 0), -1);
}

testFindNthTextMatchIndexLocatesRepeatedMatches();
testFindNthTextMatchIndexReturnsMinusOneWhenMissing();
console.log('text match locator tests passed');
