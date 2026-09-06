'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const packageManager = require('../src/core/package-manager');
const { makeTmpDir, removeTmpDir } = require('./helpers');

test('defaults to npm when nothing is declared and no lockfile exists', () => {
  const dir = makeTmpDir();
  try {
    const result = packageManager.detect(dir, {});
    assert.equal(result.name, 'npm');
    assert.equal(result.source, 'default');
    assert.equal(result.conflict, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('detects package manager from a single lockfile', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    const result = packageManager.detect(dir, {});
    assert.equal(result.name, 'pnpm');
    assert.equal(result.source, 'lockfile');
    assert.equal(result.conflict, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('prefers the packageManager field over the lockfile when they agree', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
    const result = packageManager.detect(dir, { packageManager: 'yarn@3.6.0' });
    assert.equal(result.name, 'yarn');
    assert.equal(result.source, 'packageManager-field');
    assert.equal(result.declared, 'yarn@3.6.0');
    assert.equal(result.conflict, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('flags a conflict when packageManager field and lockfile disagree', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    const result = packageManager.detect(dir, { packageManager: 'pnpm@8.15.4' });
    assert.equal(result.name, 'pnpm'); // declared field wins
    assert.equal(result.conflict, true);
    assert.match(result.warning, /pnpm/);
    assert.match(result.warning, /npm/);
  } finally {
    removeTmpDir(dir);
  }
});

test('flags a conflict when multiple lockfiles are present', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    const result = packageManager.detect(dir, {});
    assert.equal(result.conflict, true);
    assert.equal(result.lockfiles.length, 2);
  } finally {
    removeTmpDir(dir);
  }
});

test('ignores an unrecognized packageManager field instead of spawning it', () => {
  const dir = makeTmpDir();
  try {
    const result = packageManager.detect(dir, { packageManager: 'totally-not-a-real-tool@1.0.0' });
    assert.equal(result.name, 'npm');
    assert.equal(result.source, 'default');
    assert.equal(result.declared, null);
  } finally {
    removeTmpDir(dir);
  }
});

test('runScriptArgs forwards extra args after --', () => {
  assert.deepEqual(packageManager.runScriptArgs('test', []), ['run', 'test']);
  assert.deepEqual(packageManager.runScriptArgs('test', ['--runInBand']), [
    'run',
    'test',
    '--',
    '--runInBand',
  ]);
});
