'use strict';

const runner = require('./runner');

// name: display label, command/args: how to probe, parse: extract a short
// version string from the probe output (some tools print to stderr, e.g. java).
const TOOL_DEFS = [
  { key: 'node', name: 'Node', command: 'node', args: ['--version'], parse: (o) => o.stdout.trim() },
  { key: 'npm', name: 'npm', command: 'npm', args: ['--version'], parse: (o) => o.stdout.trim() },
  { key: 'pnpm', name: 'pnpm', command: 'pnpm', args: ['--version'], parse: (o) => o.stdout.trim() },
  { key: 'yarn', name: 'Yarn', command: 'yarn', args: ['--version'], parse: (o) => o.stdout.trim() },
  { key: 'bun', name: 'Bun', command: 'bun', args: ['--version'], parse: (o) => o.stdout.trim() },
  { key: 'git', name: 'Git', command: 'git', args: ['--version'], parse: (o) => o.stdout.trim().replace(/^git version /, '') },
  { key: 'docker', name: 'Docker', command: 'docker', args: ['--version'], parse: (o) => o.stdout.trim() },
  {
    key: 'dockerCompose',
    name: 'Docker Compose',
    command: 'docker',
    args: ['compose', 'version'],
    parse: (o) => o.stdout.trim(),
  },
  {
    key: 'java',
    name: 'Java',
    command: 'java',
    args: ['-version'],
    // java prints its version banner to stderr, not stdout. Some setups also
    // print an unrelated "Picked up JAVA_TOOL_OPTIONS: ..." line to stderr
    // first, so look for the actual "... version ..." line rather than
    // assuming it's the first line.
    parse: (o) => extractLine(o.stderr, /\bversion\b/),
  },
  { key: 'maven', name: 'Maven', command: 'mvn', args: ['--version'], parse: (o) => (o.stdout.trim().split('\n')[0] || '').trim() },
  { key: 'gradle', name: 'Gradle', command: 'gradle', args: ['--version'], parse: (o) => extractLine(o.stdout, /^Gradle /) },
];

function extractLine(text, pattern) {
  const line = (text || '').split('\n').find((l) => pattern.test(l));
  return line ? line.trim() : (text || '').trim().split('\n')[0];
}

async function probeTool(def) {
  const result = await runner.run(def.command, def.args, { timeoutMs: 10000 });
  if (result.spawnFailed || result.exitCode === null) {
    return { key: def.key, name: def.name, installed: false, version: null };
  }
  const version = def.parse(result) || null;
  return { key: def.key, name: def.name, installed: true, version };
}

async function probeAll() {
  return Promise.all(TOOL_DEFS.map(probeTool));
}

module.exports = { TOOL_DEFS, probeTool, probeAll };
