'use strict';

const fs = require('fs');
const path = require('path');

function exists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function existsAny(dir, names) {
  return names.filter((name) => exists(path.join(dir, name)));
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function isSymlink(targetPath) {
  try {
    return fs.lstatSync(targetPath).isSymbolicLink();
  } catch {
    return false;
  }
}

function listTopLevel(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : entry.isSymbolicLink() ? 'symlink' : 'file',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

module.exports = {
  exists,
  existsAny,
  readJsonSafe,
  isDirectory,
  isSymlink,
  listTopLevel,
};
