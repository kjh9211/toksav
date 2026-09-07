'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const project = require('../src/core/project');
const { makeTmpDir, removeTmpDir } = require('./helpers');

test('readPackageJson parses a normal package.json', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'foo' } }));
    const pkg = project.readPackageJson(dir);
    assert.equal(pkg.name, 'x');
    assert.deepEqual(pkg.scripts, { test: 'foo' });
  } finally {
    removeTmpDir(dir);
  }
});

test('readPackageJson strips a leading UTF-8 BOM (e.g. from PowerShell -Encoding UTF8)', () => {
  const dir = makeTmpDir();
  try {
    const json = JSON.stringify({ name: 'x', scripts: { test: 'foo', build: 'bar' } });
    fs.writeFileSync(path.join(dir, 'package.json'), `﻿${json}`, 'utf8');
    const pkg = project.readPackageJson(dir);
    assert.ok(pkg, 'expected package.json to parse despite the BOM');
    assert.deepEqual(pkg.scripts, { test: 'foo', build: 'bar' });
  } finally {
    removeTmpDir(dir);
  }
});

test('readPackageJson returns null for genuinely invalid JSON', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{ not valid json');
    assert.equal(project.readPackageJson(dir), null);
  } finally {
    removeTmpDir(dir);
  }
});

test('detectProject prefers package.json over pom.xml/build.gradle', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    fs.writeFileSync(path.join(dir, 'pom.xml'), '<project/>');
    const result = project.detectProject(dir);
    assert.equal(result.type, 'node');
    assert.equal(result.root, dir);
  } finally {
    removeTmpDir(dir);
  }
});

// Regression: on a real machine, the OS temp directory is typically nested
// *inside* the user's home directory (e.g. Windows' %TEMP%). If the home
// directory happens to be a git repo with its own package.json (a dotfiles
// repo, say), running ait from any scratch/temp path previously walked all
// the way up into it and mistook it for "the project" — which is not just
// wrong for inspect/verify, it's a real safety problem for `clean`, which
// would then operate on the wrong directory. findAncestorWith/findGitRoot
// must not search above the given ceiling.
test('findAncestorWith does not search for markers above the ceiling', () => {
  const outer = makeTmpDir(); // stands in for "the user's home directory"
  try {
    fs.writeFileSync(path.join(outer, 'package.json'), '{}'); // unrelated project marker
    const ceiling = path.join(outer, 'tmp'); // stands in for os.tmpdir()
    const scratch = path.join(ceiling, 'scratch-project-xyz');
    fs.mkdirSync(scratch, { recursive: true });

    const result = project.findAncestorWith(scratch, ['package.json'], ceiling);
    assert.equal(result, null, 'must not find the unrelated package.json above the ceiling');
  } finally {
    removeTmpDir(outer);
  }
});

test('findAncestorWith still finds a marker at or below the ceiling', () => {
  const outer = makeTmpDir();
  try {
    const ceiling = path.join(outer, 'tmp');
    const scratch = path.join(ceiling, 'scratch-project-xyz');
    fs.mkdirSync(scratch, { recursive: true });
    fs.writeFileSync(path.join(scratch, 'package.json'), '{}');

    const result = project.findAncestorWith(scratch, ['package.json'], ceiling);
    assert.equal(result, scratch);
  } finally {
    removeTmpDir(outer);
  }
});

test('findGitRoot does not search for .git above the ceiling', () => {
  const outer = makeTmpDir();
  try {
    fs.mkdirSync(path.join(outer, '.git'));
    const ceiling = path.join(outer, 'tmp');
    const scratch = path.join(ceiling, 'scratch-project-xyz');
    fs.mkdirSync(scratch, { recursive: true });

    const result = project.findGitRoot(scratch, ceiling);
    assert.equal(result, null, 'must not find the unrelated .git above the ceiling');
  } finally {
    removeTmpDir(outer);
  }
});
