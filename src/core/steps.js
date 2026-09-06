'use strict';

const runner = require('./runner');
const packageManager = require('./package-manager');
const scripts = require('./scripts');
const output = require('./output');

/**
 * Run one category (lint/typecheck/test/build) against the detected
 * package manager. Returns a normalized step result; never throws.
 */
async function runStep({ category, label, cwd, scriptsMap, pmName, extraArgs = [], timeoutMs }) {
  const name = label || category;
  const scriptName = scripts.detectScript(scriptsMap, category);

  if (!scriptName) {
    return { name, status: 'skipped', reason: 'script not found' };
  }

  const args = packageManager.runScriptArgs(scriptName, extraArgs);
  const command = `${pmName} ${args.join(' ')}`;
  const start = Date.now();
  const result = await runner.run(pmName, args, { cwd, timeoutMs });
  const durationMs = Date.now() - start;

  if (result.spawnFailed) {
    return {
      name,
      status: 'failed',
      exitCode: null,
      durationMs,
      command,
      error: result.error,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    name,
    status: result.exitCode === 0 ? 'passed' : 'failed',
    exitCode: result.exitCode,
    durationMs,
    command,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function formatStepLine(step) {
  const { color } = output;
  const namePad = step.name.padEnd(10);
  if (step.status === 'passed') {
    return `${color.green('[PASS]')} ${namePad} ${(step.durationMs / 1000).toFixed(2)}s`;
  }
  if (step.status === 'skipped') {
    return `${color.yellow('[SKIP]')} ${namePad} ${step.reason}`;
  }
  if (step.status === 'failed') {
    const suffix = step.timedOut
      ? 'timed out'
      : step.error
        ? step.error
        : `exit code ${step.exitCode}`;
    return `${color.red('[FAIL]')} ${namePad} ${suffix}`;
  }
  return `${step.name}: ${step.status}`;
}

function printFailureDetail(step) {
  const { printLine, truncate } = output;
  printLine('');
  printLine(`[FAIL] ${step.name}`);
  printLine(`Command: ${step.command}`);
  if (step.timedOut) {
    printLine('Timed out');
  } else {
    printLine(`Exit code: ${step.exitCode}`);
  }
  if (step.error) {
    printLine(`Error: ${step.error}`);
  }
  // Different tools put the useful error on different streams (eslint/tsc
  // often on stdout, npm's own diagnostics on stderr), so show whichever
  // streams actually have content instead of guessing one.
  const stdout = truncate(step.stdout, 4000);
  const stderr = truncate(step.stderr, 4000);
  if (stdout.text.trim()) {
    printLine('');
    printLine('stdout:');
    printLine(stdout.text.trim());
  }
  if (stderr.text.trim()) {
    printLine('');
    printLine('stderr:');
    printLine(stderr.text.trim());
  }
}

module.exports = { runStep, formatStepLine, printFailureDetail };
