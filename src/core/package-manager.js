'use strict';

const path = require('path');
const { exists } = require('./fs-utils');

const LOCKFILES = [
  { name: 'pnpm-lock.yaml', manager: 'pnpm' },
  { name: 'yarn.lock', manager: 'yarn' },
  { name: 'bun.lockb', manager: 'bun' },
  { name: 'bun.lock', manager: 'bun' },
  { name: 'package-lock.json', manager: 'npm' },
];

function parsePackageManagerField(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^([a-z]+)@([^\s+]+)/i);
  if (!match) return null;
  return { name: match[1].toLowerCase(), version: match[2] };
}

/**
 * Detect the package manager for a Node project rooted at `root`.
 *
 * Precedence:
 *   1. package.json#packageManager (explicit, corepack-style declaration)
 *   2. lockfile present on disk
 *   3. default to npm
 *
 * If the declared packageManager and the lockfile found on disk disagree,
 * `conflict` is set with a human-readable warning so callers (inspect/deps)
 * can surface it.
 */
function detect(root, pkgJson) {
  const foundLockfiles = LOCKFILES.filter((lf) => exists(path.join(root, lf.name)));
  const declared = parsePackageManagerField(pkgJson && pkgJson.packageManager);

  const lockfileManager = foundLockfiles.length > 0 ? foundLockfiles[0].manager : null;

  let name;
  let source;
  if (declared) {
    name = declared.name;
    source = 'packageManager-field';
  } else if (lockfileManager) {
    name = lockfileManager;
    source = 'lockfile';
  } else {
    name = 'npm';
    source = 'default';
  }

  let conflict = false;
  let warning = null;

  if (declared && lockfileManager && declared.name !== lockfileManager) {
    conflict = true;
    warning = `packageManager field declares "${declared.name}" but a ${lockfileManager} lockfile was found. Using "${name}" (from ${source}).`;
  } else if (foundLockfiles.length > 1) {
    conflict = true;
    const names = foundLockfiles.map((lf) => lf.name).join(', ');
    warning = `Multiple lockfiles found (${names}). Using "${name}".`;
  }

  return {
    name,
    source,
    declared: declared ? `${declared.name}@${declared.version}` : null,
    lockfiles: foundLockfiles.map((lf) => lf.name),
    conflict,
    warning,
  };
}

/**
 * Build the argv for running a package.json script through the detected
 * package manager, forwarding extra args after `--` uniformly across
 * npm/pnpm/yarn/bun.
 */
function runScriptArgs(scriptName, extraArgs = []) {
  const args = ['run', scriptName];
  if (extraArgs.length > 0) {
    args.push('--', ...extraArgs);
  }
  return args;
}

module.exports = {
  LOCKFILES,
  parsePackageManagerField,
  detect,
  runScriptArgs,
};
