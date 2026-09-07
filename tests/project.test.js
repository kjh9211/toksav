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
