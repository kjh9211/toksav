'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resolveSafeTarget, DEFAULT_TARGETS, DEPS_TARGET } = require('../src/commands/clean');
const { makeTmpDir, removeTmpDir } = require('./helpers');

test('default whitelist only contains the documented safe targets', () => {
  assert.deepEqual(DEFAULT_TARGETS, ['dist', 'build', '.next', 'coverage', '.turbo']);
  assert.equal(DEPS_TARGET, 'node_modules');
});

test('accepts a whitelisted target inside the project root', () => {
  const dir = makeTmpDir();
  try {
    const result = resolveSafeTarget(dir, 'dist');
    assert.equal(result.safe, true);
    assert.equal(result.path, path.join(dir, 'dist'));
  } finally {
    removeTmpDir(dir);
  }
});

test('refuses to target the project root itself', () => {
  const dir = makeTmpDir();
  try {
    const result = resolveSafeTarget(dir, '.');
    assert.equal(result.safe, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('refuses protected paths like .git and src', () => {
  const dir = makeTmpDir();
  try {
    assert.equal(resolveSafeTarget(dir, '.git').safe, false);
    assert.equal(resolveSafeTarget(dir, 'src').safe, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('refuses a path-traversal attempt that resolves outside the project root', () => {
  const dir = makeTmpDir();
  try {
    const result = resolveSafeTarget(dir, '../../etc');
    assert.equal(result.safe, false);
    assert.match(result.reason, /outside/);
  } finally {
    removeTmpDir(dir);
  }
});

test('--dry-run never touches the filesystem', async () => {
  const dir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist', 'bundle.js'), '// built');

    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      const clean = require('../src/commands/clean');
      const exitCode = await clean.run({ flags: { dryRun: true, json: true } });
      assert.equal(exitCode, 0);
    } finally {
      process.chdir(originalCwd);
    }

    assert.equal(fs.existsSync(path.join(dir, 'dist')), true);
    assert.equal(fs.existsSync(path.join(dir, 'dist', 'bundle.js')), true);
  } finally {
    removeTmpDir(dir);
  }
});

test('clean only removes whitelisted directories that actually exist, nothing else', async () => {
  const dir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'keep.txt'), 'keep me');

    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      const clean = require('../src/commands/clean');
      await clean.run({ flags: { json: true } });
    } finally {
      process.chdir(originalCwd);
    }

    assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
    assert.equal(fs.existsSync(path.join(dir, 'src')), true);
    assert.equal(fs.existsSync(path.join(dir, 'keep.txt')), true);
  } finally {
    removeTmpDir(dir);
  }
});

test('node_modules is only removed with the explicit --deps flag', async () => {
  const dir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'placeholder'), '');

    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      const clean = require('../src/commands/clean');
      await clean.run({ flags: { json: true } });
      assert.equal(fs.existsSync(path.join(dir, 'node_modules')), true, 'must survive without --deps');

      await clean.run({ flags: { json: true, deps: true } });
      assert.equal(fs.existsSync(path.join(dir, 'node_modules')), false, 'removed with --deps');
    } finally {
      process.chdir(originalCwd);
    }
  } finally {
    removeTmpDir(dir);
  }
});
