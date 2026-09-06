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

test('needsShellOnWindows is false on non-Windows platforms', () => {
  withPlatform('linux', () => {
    assert.equal(platform.needsShellOnWindows('npm'), false);
    assert.equal(platform.isWindows(), false);
  });
  withPlatform('darwin', () => {
    assert.equal(platform.needsShellOnWindows('npm'), false);
  });
});

test('needsShellOnWindows is true only for the known .cmd/.bat shim commands on Windows', () => {
  withPlatform('win32', () => {
    assert.equal(platform.isWindows(), true);
    for (const cmd of ['npm', 'npx', 'pnpm', 'yarn', 'bun', 'mvn', 'gradle']) {
      assert.equal(platform.needsShellOnWindows(cmd), true, cmd);
    }
    // Native executables and arbitrary user input must never trigger shell:true.
    assert.equal(platform.needsShellOnWindows('git'), false);
    assert.equal(platform.needsShellOnWindows('node'), false);
    assert.equal(platform.needsShellOnWindows('rm -rf /'), false);
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
