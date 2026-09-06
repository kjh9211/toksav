'use strict';

function colorEnabled() {
  return Boolean(process.stdout.isTTY) && !process.env.CI && !process.env.NO_COLOR;
}

const CODES = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function paint(code, text) {
  if (!colorEnabled()) return text;
  return `${CODES[code]}${text}${CODES.reset}`;
}

const color = {
  green: (t) => paint('green', t),
  red: (t) => paint('red', t),
  yellow: (t) => paint('yellow', t),
  dim: (t) => paint('dim', t),
  cyan: (t) => paint('cyan', t),
};

function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function printLine(text = '') {
  process.stdout.write(`${text}\n`);
}

function truncate(str, maxLen = 20000) {
  if (!str || str.length <= maxLen) return { text: str || '', truncated: false };
  return {
    text: `${str.slice(-maxLen)}\n... (truncated, showing last ${maxLen} chars)`,
    truncated: true,
  };
}

module.exports = {
  colorEnabled,
  color,
  printJson,
  printLine,
  truncate,
};
