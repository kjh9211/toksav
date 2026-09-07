'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const platform = require('../src/core/platform');

function withPlatform(value, fn) {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value, configurable: true });
  try {
    fn();
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
}

test('isWindows/isMac/isLinux reflect process.platform', () => {
  withPlatform('linux', () => {
    assert.equal(platform.isWindows(), false);
    assert.equal(platform.isLinux(), true);
  });
  withPlatform('win32', () => {
    assert.equal(platform.isWindows(), true);
  });
  withPlatform('darwin', () => {
    assert.equal(platform.isMac(), true);
  });
});

test('platformName maps known process.platform values to friendly names', () => {
  withPlatform('win32', () => assert.equal(platform.platformName(), 'windows'));
  withPlatform('darwin', () => assert.equal(platform.platformName(), 'macos'));
  withPlatform('linux', () => assert.equal(platform.platformName(), 'linux'));
});

test('summary() reports platform/arch/release', () => {
  const summary = platform.summary();
  assert.ok(summary.platform);
  assert.ok(summary.arch);
  assert.ok(summary.release);
});
