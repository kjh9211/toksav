'use strict';

const { resolveNodeContext } = require('../core/node-context');
const { runStep, formatStepLine, printFailureDetail, stripStepForJson } = require('../core/steps');
const { reportNoProject } = require('./verify');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

async function run({ flags, extraArgs }) {
  const cwd = process.cwd();
  const ctx = resolveNodeContext(cwd);

  if (!ctx.ok) {
    return reportNoProject('build', ctx, flags);
  }

  const step = await runStep({
    category: 'build',
    cwd: ctx.root,
    scriptsMap: ctx.scripts,
    pmName: ctx.packageManager.name,
    extraArgs,
    timeoutMs: flags.timeout,
  });

  if (step.status === 'skipped') {
    if (flags.json) {
      output.printJson({ command: 'build', ok: false, error: 'no build script found in package.json' });
    } else {
      process.stderr.write('No build script found in package.json.\n');
    }
    return exitCodes.CHECK_FAILED;
  }

  if (flags.json) {
    output.printJson({ command: 'build', ok: step.status === 'passed', step: stripStepForJson(step) });
    return step.status === 'passed' ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine } = output;
  printLine(formatStepLine(step));
  if (step.status === 'failed') printFailureDetail(step);

  return step.status === 'passed' ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

module.exports = { run };
