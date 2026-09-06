'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSsOutput,
  parseLsofOutput,
  parseNetstatOutput,
  parseTasklistCsv,
} = require('../src/core/ports');

test('parseLsofOutput parses a real lsof -i listing', () => {
  const output = [
    'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
    'node    2496 root   21u  IPv4   5624      0t0  TCP *:58234 (LISTEN)',
  ].join('\n');
  const matches = parseLsofOutput(output);
  assert.deepEqual(matches, [{ pid: 2496, process: 'node', local: '*:58234' }]);
});

test('parseLsofOutput returns an empty array when nothing is listening', () => {
  assert.deepEqual(parseLsofOutput(''), []);
});

test('parseSsOutput extracts pid/process/local from a ss -tlnp line', () => {
  const output = 'LISTEN 0      511          0.0.0.0:3000       0.0.0.0:*    users:(("node",pid=1234,fd=23))';
  const matches = parseSsOutput(output, 3000);
  assert.deepEqual(matches, [{ pid: 1234, process: 'node', local: '0.0.0.0:3000' }]);
});

test('parseSsOutput ignores lines for other ports', () => {
  const output = 'LISTEN 0 511 0.0.0.0:4000 0.0.0.0:* users:(("node",pid=1,fd=1))';
  assert.deepEqual(parseSsOutput(output, 3000), []);
});

test('parseNetstatOutput parses a Windows netstat -ano listing', () => {
  const output = [
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       14220',
    '  TCP    127.0.0.1:5000         0.0.0.0:0              ESTABLISHED     999',
  ].join('\r\n');
  const matches = parseNetstatOutput(output);
  assert.deepEqual(matches, [{ pid: 14220, process: null, local: '0.0.0.0:3000' }]);
});

test('parseTasklistCsv extracts the process name from a CSV, no-header tasklist row', () => {
  const output = '"node.exe","14220","Console","1","12,345 K"';
  assert.equal(parseTasklistCsv(output), 'node.exe');
});

test('parseTasklistCsv returns null for empty output', () => {
  assert.equal(parseTasklistCsv(''), null);
});
