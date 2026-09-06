'use strict';

const { resolveNodeContext } = require('../core/node-context');
const { runStep, formatStepLine, printFailureDetail } = require('../core/steps');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

const CATEGORIES = ['lint', 'typecheck', 'test', 'build'];

async function run({ flags }) {
  const cwd = process.cwd();
  const ctx = resolveNodeContext(cwd);
  const start = Date.now();

  if (!ctx.ok) {
    return reportNoProject('verify', ctx, flags);
  }

  const steps = [];
  let failFastTriggered = false;

  for (const category of CATEGORIES) {
    if (failFastTriggered) {
      steps.push({ name: category, status: 'skipped', reason: 'fail-fast: earlier step failed' });
      continue;
    }
    const step = await runStep({
      category,
      cwd: ctx.root,
      scriptsMap: ctx.scripts,
      pmName: ctx.packageManager.name,
      timeoutMs: flags.timeout,
    });
    steps.push(step);
    if (step.status === 'failed' && flags.failFast) {
      failFastTriggered = true;
    }
  }

  const durationMs = Date.now() - start;
  const passed = steps.filter((s) => s.status === 'passed').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  const failed = steps.filter((s) => s.status === 'failed');
  const ok = failed.length === 0;

  if (flags.json) {
    output.printJson({
      command: 'verify',
      ok,
      durationMs,
      steps: steps.map(stripOutputForJson),
    });
    return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine } = output;
  for (const step of steps) printLine(formatStepLine(step));
  printLine('');
  printLine(ok ? 'Verification passed.' : 'Verification failed.');
  printLine('');
  printLine(`Passed: ${passed}`);
  printLine(`Skipped: ${skipped}`);
  printLine(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    printLine('');
    printLine('Failed step:');
    for (const step of failed) printLine(step.name);
    for (const step of failed) printFailureDetail(step);
  }

  return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

function stripOutputForJson(step) {
  const { truncate } = output;
  const copy = { ...step };
  if (copy.stdout != null) copy.stdout = truncate(copy.stdout, 20000).text;
  if (copy.stderr != null) copy.stderr = truncate(copy.stderr, 20000).text;
  return copy;
}

function reportNoProject(command, ctx, flags) {
  const message =
    ctx.type === 'unknown'
      ? 'No supported project detected (no package.json, pom.xml, or build.gradle found).'
      : `Detected a ${ctx.type} project, but script execution for ${ctx.type} is not implemented in this version.`;

  if (flags.json) {
    output.printJson({ command, ok: false, error: message, projectRoot: ctx.root, projectType: ctx.type });
  } else {
    process.stderr.write(`${message}\n`);
  }
  return exitCodes.PROJECT_NOT_DETECTED;
}

module.exports = { run, reportNoProject, CATEGORIES };
