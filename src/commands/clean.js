'use strict';

const fs = require('fs');
const path = require('path');
const project = require('../core/project');
const { isDirectory, isSymlink } = require('../core/fs-utils');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

// Explicit whitelist of build-output/cache directories that are always safe
// to delete. Never derived from user input, never expanded at runtime.
const DEFAULT_TARGETS = ['dist', 'build', '.next', 'coverage', '.turbo'];
const DEPS_TARGET = 'node_modules';

// Defense in depth: even if DEFAULT_TARGETS were ever misconfigured, these
// names can never be deleted by this command.
const NEVER_DELETE = new Set(['.', '..', '', '.git', 'src']);

function resolveSafeTarget(root, name) {
  if (NEVER_DELETE.has(name)) return { safe: false, reason: 'protected path' };

  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(root, name);

  if (candidate === resolvedRoot) return { safe: false, reason: 'refuses to target the project root' };
  if (!(candidate + path.sep).startsWith(resolvedRoot + path.sep)) {
    return { safe: false, reason: 'resolves outside the project root' };
  }

  return { safe: true, path: candidate };
}

async function run({ flags }) {
  const cwd = process.cwd();
  const { root } = project.detectProject(cwd);
  const dryRun = Boolean(flags.dryRun);

  const targets = [...DEFAULT_TARGETS];
  if (flags.deps) targets.push(DEPS_TARGET);

  const results = [];

  for (const name of targets) {
    const check = resolveSafeTarget(root, name);
    if (!check.safe) {
      results.push({ name, status: 'blocked', reason: check.reason });
      continue;
    }

    if (!fs.existsSync(check.path)) {
      results.push({ name, status: 'skipped', reason: 'not found' });
      continue;
    }

    if (isSymlink(check.path)) {
      results.push({ name, status: 'skipped', reason: 'is a symlink, not following it' });
      continue;
    }

    if (!isDirectory(check.path)) {
      results.push({ name, status: 'skipped', reason: 'not a directory' });
      continue;
    }

    if (dryRun) {
      results.push({ name, status: 'would-remove' });
      continue;
    }

    try {
      fs.rmSync(check.path, { recursive: true, force: false });
      results.push({ name, status: 'removed' });
    } catch (err) {
      results.push({ name, status: 'error', reason: err.message });
    }
  }

  const removed = results.filter((r) => r.status === 'removed').length;
  const wouldRemove = results.filter((r) => r.status === 'would-remove').length;
  const errors = results.filter((r) => r.status === 'error');
  const ok = errors.length === 0;

  if (flags.json) {
    output.printJson({ command: 'clean', ok, projectRoot: root, dryRun, targets: results });
    return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine } = output;
  printLine(`Cleaning project: ${root}`);
  printLine('');
  for (const r of results) {
    if (r.status === 'removed') printLine(`[REMOVED] ${r.name}`);
    else if (r.status === 'would-remove') printLine(`[WOULD REMOVE] ${r.name}`);
    else if (r.status === 'skipped') printLine(`[SKIP] ${r.name} (${r.reason})`);
    else if (r.status === 'blocked') printLine(`[BLOCKED] ${r.name} (${r.reason})`);
    else if (r.status === 'error') printLine(`[ERROR] ${r.name} (${r.reason})`);
  }
  printLine('');
  if (dryRun) {
    printLine(`${targets.length} targets checked, ${wouldRemove} would be removed.`);
  } else {
    printLine(`${targets.length} targets checked, ${removed} removed.`);
  }

  return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

module.exports = { run, resolveSafeTarget, DEFAULT_TARGETS, DEPS_TARGET, NEVER_DELETE };
