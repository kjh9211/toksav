'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeTmpDir, removeTmpDir } = require('./helpers');

const AIT_BIN = path.join(__dirname, '..', 'bin', 'ait.js');

function runAit(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [AIT_BIN, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
  }
}

function makeFixtureProject(scripts) {
  const dir = makeTmpDir('ait-fixture-');
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', scripts }, null, 2)
  );
  return dir;
}

test('verify --json prints only valid JSON to stdout', () => {
  const dir = makeFixtureProject({
    lint: 'node -e "process.exit(0)"',
    test: 'node -e "process.exit(0)"',
    build: 'node -e "process.exit(0)"',
  });
  try {
    const { stdout, exitCode } = runAit(['verify', '--json'], dir);
    const parsed = JSON.parse(stdout);
    assert.equal(exitCode, 0);
    assert.equal(parsed.command, 'verify');
    assert.equal(parsed.ok, true);

    const byName = Object.fromEntries(parsed.steps.map((s) => [s.name, s]));
    assert.equal(byName.lint.status, 'passed');
    assert.equal(byName.typecheck.status, 'skipped');
    assert.equal(byName.typecheck.reason, 'script not found');
    assert.equal(byName.test.status, 'passed');
    assert.equal(byName.build.status, 'passed');
  } finally {
    removeTmpDir(dir);
  }
});

test('verify continues past a failed step by default and exits 1', () => {
  const dir = makeFixtureProject({
    lint: 'node -e "process.exit(0)"',
    test: 'node -e "process.exit(1)"',
    build: 'node -e "process.exit(0)"',
  });
  try {
    const { stdout, exitCode } = runAit(['verify', '--json'], dir);
    const parsed = JSON.parse(stdout);
    assert.equal(exitCode, 1);
    assert.equal(parsed.ok, false);
    const byName = Object.fromEntries(parsed.steps.map((s) => [s.name, s]));
    assert.equal(byName.test.status, 'failed');
    assert.equal(byName.test.exitCode, 1);
    // build still ran even though test failed (default is not fail-fast).
    assert.equal(byName.build.status, 'passed');
  } finally {
    removeTmpDir(dir);
  }
});

test('verify --fail-fast skips remaining steps after the first failure', () => {
  const dir = makeFixtureProject({
    lint: 'node -e "process.exit(1)"',
    test: 'node -e "process.exit(0)"',
    build: 'node -e "process.exit(0)"',
  });
  try {
    const { stdout, exitCode } = runAit(['verify', '--json', '--fail-fast'], dir);
    const parsed = JSON.parse(stdout);
    assert.equal(exitCode, 1);
    const byName = Object.fromEntries(parsed.steps.map((s) => [s.name, s]));
    assert.equal(byName.lint.status, 'failed');
    assert.equal(byName.typecheck.status, 'skipped');
    assert.equal(byName.test.status, 'skipped');
    assert.match(byName.test.reason, /fail-fast/);
    assert.equal(byName.build.status, 'skipped');
  } finally {
    removeTmpDir(dir);
  }
});

test('verify exits with PROJECT_NOT_DETECTED (3) when there is no package.json', () => {
  const dir = makeTmpDir('ait-empty-');
  try {
    const { stdout, exitCode } = runAit(['verify', '--json'], dir);
    const parsed = JSON.parse(stdout);
    assert.equal(exitCode, 3);
    assert.equal(parsed.ok, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('test command reports CHECK_FAILED (1) when no test script exists', () => {
  const dir = makeFixtureProject({ build: 'node -e "process.exit(0)"' });
  try {
    const { stdout, exitCode } = runAit(['test', '--json'], dir);
    const parsed = JSON.parse(stdout);
    assert.equal(exitCode, 1);
    assert.equal(parsed.ok, false);
  } finally {
    removeTmpDir(dir);
  }
});

test('unknown command exits with USAGE_ERROR (2)', () => {
  const dir = makeFixtureProject({});
  try {
    const { exitCode } = runAit(['not-a-real-command'], dir);
    assert.equal(exitCode, 2);
  } finally {
    removeTmpDir(dir);
  }
});

test('port with an invalid port number exits with USAGE_ERROR (2)', () => {
  const dir = makeFixtureProject({});
  try {
    const { exitCode } = runAit(['port', 'not-a-port'], dir);
    assert.equal(exitCode, 2);
  } finally {
    removeTmpDir(dir);
  }
});

test('doctor --json prints only valid JSON to stdout', () => {
  const { stdout, exitCode } = runAit(['doctor', '--json'], process.cwd());
  const parsed = JSON.parse(stdout);
  assert.equal(exitCode, 0);
  assert.equal(parsed.command, 'doctor');
  assert.ok(Array.isArray(parsed.tools));
});

test('inspect --json prints only valid JSON to stdout', () => {
  const dir = makeFixtureProject({ test: 'node -e "process.exit(0)"' });
  try {
    const { stdout, exitCode } = runAit(['inspect', '--json'], dir);
    const parsed = JSON.parse(stdout);
    assert.equal(exitCode, 0);
    assert.equal(parsed.command, 'inspect');
    assert.equal(parsed.projectType, 'node');
  } finally {
    removeTmpDir(dir);
  }
});
