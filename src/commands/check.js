'use strict';

const { resolveNodeContext } = require('../core/node-context');
const { runStep, formatStepLine, printFailureDetail, stripStepForJson } = require('../core/steps');
const { reportNoProject } = require('./verify');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

const CATEGORIES = ['lint', 'typecheck'];

async function run({ flags }) {
  const cwd = process.cwd();
  const ctx = resolveNodeContext(cwd);
  const start = Date.now();

  if (!ctx.ok) {
    return reportNoProject('check', ctx, flags);
  }

  const steps = [];
  for (const category of CATEGORIES) {
    steps.push(
      await runStep({
        category,
        cwd: ctx.root,
        scriptsMap: ctx.scripts,
        pmName: ctx.packageManager.name,
        timeoutMs: flags.timeout,
      })
    );
  }

  const durationMs = Date.now() - start;
  const failed = steps.filter((s) => s.status === 'failed');
  const ok = failed.length === 0;

  if (flags.json) {
    output.printJson({
      command: 'check',
      ok,
      durationMs,
      steps: steps.map(stripStepForJson),
    });
    return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine } = output;
  for (const step of steps) printLine(formatStepLine(step));
  for (const step of failed) printFailureDetail(step);

  return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

module.exports = { run };
