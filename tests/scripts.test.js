'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectScript } = require('../src/core/scripts');

test('returns null when scripts is missing or empty', () => {
  assert.equal(detectScript(null, 'lint'), null);
  assert.equal(detectScript({}, 'lint'), null);
});

test('detects the first matching candidate name in priority order', () => {
  assert.equal(detectScript({ lint: 'eslint .', eslint: 'eslint .' }, 'lint'), 'lint');
  assert.equal(detectScript({ eslint: 'eslint .' }, 'lint'), 'eslint');
});

test('typecheck candidates are checked in order', () => {
  assert.equal(detectScript({ tsc: 'tsc --noEmit', typecheck: 'tsc --noEmit' }, 'typecheck'), 'typecheck');
  assert.equal(detectScript({ 'check-types': 'tsc --noEmit' }, 'typecheck'), 'check-types');
  assert.equal(detectScript({ tsc: 'tsc --noEmit' }, 'typecheck'), 'tsc');
});

test('test candidates prefer "test" over "test:unit"', () => {
  assert.equal(detectScript({ test: 'node --test', 'test:unit': 'node --test unit' }, 'test'), 'test');
  assert.equal(detectScript({ 'test:unit': 'node --test unit' }, 'test'), 'test:unit');
});

test('build only matches the exact "build" script name', () => {
  assert.equal(detectScript({ build: 'tsc -p .' }, 'build'), 'build');
  assert.equal(detectScript({ 'build:prod': 'tsc -p .' }, 'build'), null);
});

test('never matches an unrelated script for a category', () => {
  assert.equal(detectScript({ deploy: 'sh deploy.sh' }, 'build'), null);
});
