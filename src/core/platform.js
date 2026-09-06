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

// Commands that ship as .cmd/.bat shims on Windows and therefore cannot be
// spawned directly without going through a shell. Kept as an explicit
// whitelist so `shell: true` is only ever used for these known-safe cases,
// never for arbitrary user input.
const WINDOWS_SHELL_COMMANDS = new Set([
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'mvn',
  'gradle',
]);

function needsShellOnWindows(command) {
  if (!isWindows()) return false;
  return WINDOWS_SHELL_COMMANDS.has(command);
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
  needsShellOnWindows,
  summary,
};
