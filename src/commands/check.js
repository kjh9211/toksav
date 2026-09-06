'use strict';

const { resolveNodeContext } = require('../core/node-context');
const { runStep, formatStepLine } = require('../core/steps');
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
      steps: steps.map((s) => {
        const copy = { ...s };
        if (copy.stdout != null) copy.stdout = output.truncate(copy.stdout, 20000).text;
        if (copy.stderr != null) copy.stderr = output.truncate(copy.stderr, 20000).text;
        return copy;
      }),
    });
    return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine } = output;
  for (const step of steps) printLine(formatStepLine(step));

  return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

module.exports = { run };
