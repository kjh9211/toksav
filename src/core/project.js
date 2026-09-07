'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
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

// Windows and macOS filesystems are case-insensitive (though case-preserving),
// so the same directory can appear with different casing depending on how it
// was navigated to. POSIX (Linux) is case-sensitive.
function pathsEqual(a, b) {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

// Never search for project markers above the OS temp directory. On Windows
// and macOS in particular, %TEMP%/$TMPDIR is typically nested *inside* the
// user's home directory — so without this ceiling, running `ait` from any
// scratch/temp path (including this project's own tests, via os.tmpdir())
// would walk all the way up into the home directory and mistake it for "the
// project" if it happens to have its own package.json or .git (e.g. a
// dotfiles repo). That's not just wrong for inspect/verify, it's a real
// safety problem for `clean`, which could then operate on the wrong
// directory entirely.
function searchCeiling() {
  return path.resolve(os.tmpdir());
}

function findAncestorWith(startDir, markers, ceiling = searchCeiling()) {
  let dir = path.resolve(startDir);
  while (true) {
    for (const marker of markers) {
      if (exists(path.join(dir, marker))) {
        return dir;
      }
    }
    if (pathsEqual(dir, ceiling)) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function findGitRoot(startDir, ceiling = searchCeiling()) {
  let dir = path.resolve(startDir);
  while (true) {
    if (exists(path.join(dir, '.git'))) return dir;
    if (pathsEqual(dir, ceiling)) return null;
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
    // Strip a leading UTF-8 BOM: some Windows tools/editors (and
    // PowerShell's `-Encoding UTF8`) write one, and JSON.parse rejects it
    // outright even though the rest of the file is valid JSON.
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const withoutBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(withoutBom);
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
