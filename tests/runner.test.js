'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runner = require('../src/core/runner');
const platform = require('../src/core/platform');

test('captures stdout and a zero exit code on success', async () => {
  const result = await runner.run(process.execPath, ['-e', "process.stdout.write('hello')"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'hello');
  assert.equal(result.spawnFailed, false);
});

test('captures a non-zero exit code and stderr on failure', async () => {
  const result = await runner.run(process.execPath, [
    '-e',
    "process.stderr.write('boom'); process.exit(7)",
  ]);
  assert.equal(result.exitCode, 7);
  assert.equal(result.stderr, 'boom');
});

test('resolves (does not throw) when the command does not exist', async () => {
  const result = await runner.run('ait-command-that-definitely-does-not-exist', []);
  assert.equal(result.spawnFailed, true);
  assert.equal(result.exitCode, null);
  assert.ok(result.error);
});

test('argv is passed as an array, so shell metacharacters in args are inert', async () => {
  // `node -e <script> -- <arg>` has no script-file placeholder in argv, so
  // the forwarded arg lands at argv[1], not argv[2] as it would for a file.
  const result = await runner.run(process.execPath, [
    '-e',
    'console.log(process.argv[1])',
    '--',
    'a && echo injected; b',
  ]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), 'a && echo injected; b');
});

test('kills the process and reports timedOut when it exceeds the timeout', async () => {
  const result = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], {
    timeoutMs: 200,
  });
  assert.equal(result.timedOut, true);
});

test(
  'killing a timed-out command also kills the grandchildren it spawned (tree kill, not just the direct child)',
  { skip: platform.isWindows() ? 'tree kill uses taskkill /t on Windows' : false },
  async () => {
    // Mirrors what a package manager does: ait's direct child (here, this
    // outer node process) spawns its own child (the actual lint/test/build
    // process). Killing only the direct child would orphan the grandchild.
    const script = [
      "const { spawn } = require('child_process');",
      "const gc = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });",
      'console.log(gc.pid);',
      'setTimeout(() => {}, 30000);',
    ].join('\n');

    const result = await runner.run(process.execPath, ['-e', script], { timeoutMs: 300 });
    assert.equal(result.timedOut, true);

    const grandchildPid = Number(result.stdout.trim());
    assert.ok(Number.isInteger(grandchildPid) && grandchildPid > 0);

    // The initial SIGTERM to the grandchild can race with it just having
    // been spawned; the follow-up SIGKILL sweep (~500ms after the timeout)
    // is the guaranteed cleanup, so wait past that before checking.
    await new Promise((resolve) => setTimeout(resolve, 900));
    assert.throws(() => process.kill(grandchildPid, 0), /ESRCH/);
  }
);
