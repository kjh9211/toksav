'use strict';

const project = require('./project');
const packageManager = require('./package-manager');

/**
 * Resolve everything needed to run package.json scripts for `cwd`.
 * Returns { ok: false, root, type } when the detected project isn't a
 * Node.js project (package.json not found) so callers can report a clear
 * "project not detected" error instead of guessing.
 */
function resolveNodeContext(cwd) {
  const { root, type } = project.detectProject(cwd);
  if (type !== 'node') {
    return { ok: false, root, type };
  }
  const pkgJson = project.readPackageJson(root) || {};
  const pm = packageManager.detect(root, pkgJson);
  return {
    ok: true,
    root,
    type,
    pkgJson,
    scripts: pkgJson.scripts || {},
    packageManager: pm,
  };
}

module.exports = { resolveNodeContext };
