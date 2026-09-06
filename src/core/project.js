'use strict';

const path = require('path');
const fs = require('fs');
const { exists } = require('./fs-utils');

// Extensible registry of build systems this CLI knows how to *detect*.
// Only 'node' has full script-running support in this version; others are
// detected so `inspect`/`doctor` can report them, and so future versions can
// wire up real execution without redesigning detection.
const BUILD_SYSTEMS = {
  node: { markers: ['package.json'] },
  maven: { markers: ['pom.xml'] },
  gradle: { markers: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'] },
};

function findAncestorWith(startDir, markers) {
  let dir = path.resolve(startDir);
  while (true) {
    for (const marker of markers) {
      if (exists(path.join(dir, marker))) {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function findGitRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (exists(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Detect the project root and its build-system type, walking up from
 * `startDir`. Node.js (package.json) is preferred since it has the most
 * complete support; Maven/Gradle are detected but not fully wired up yet.
 * Falls back to the git root, then to startDir itself.
 */
function detectProject(startDir) {
  for (const type of ['node', 'maven', 'gradle']) {
    const dir = findAncestorWith(startDir, BUILD_SYSTEMS[type].markers);
    if (dir) return { root: dir, type };
  }

  const gitRoot = findGitRoot(startDir);
  if (gitRoot) return { root: gitRoot, type: 'unknown' };

  return { root: path.resolve(startDir), type: 'unknown' };
}

function readPackageJson(root) {
  const pkgPath = path.join(root, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  BUILD_SYSTEMS,
  findAncestorWith,
  findGitRoot,
  detectProject,
  readPackageJson,
};
