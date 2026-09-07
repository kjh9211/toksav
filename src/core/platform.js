'use strict';

const os = require('os');

function isWindows() {
  return process.platform === 'win32';
}

function isMac() {
  return process.platform === 'darwin';
}

function isLinux() {
  return process.platform === 'linux';
}

function platformName() {
  if (isWindows()) return 'windows';
  if (isMac()) return 'macos';
  if (isLinux()) return 'linux';
  return process.platform;
}

function summary() {
  return {
    platform: platformName(),
    arch: os.arch(),
    release: os.release(),
  };
}

module.exports = {
  isWindows,
  isMac,
  isLinux,
  platformName,
  summary,
};
