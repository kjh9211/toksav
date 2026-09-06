'use strict';

const { resolveNodeContext } = require('../core/node-context');
const { runStep, formatStepLine, printFailureDetail } = require('../core/steps');
const { reportNoProject } = require('./verify');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

async function run({ flags, extraArgs }) {
  const cwd = process.cwd();
  const ctx = resolveNodeContext(cwd);

  if (!ctx.ok) {
    return reportNoProject('test', ctx, flags);
  }

  const step = await runStep({
    category: 'test',
    cwd: ctx.root,
    scriptsMap: ctx.scripts,
    pmName: ctx.packageManager.name,
    extraArgs,
    timeoutMs: flags.timeout,
  });

  if (step.status === 'skipped') {
    if (flags.json) {
      output.printJson({ command: 'test', ok: false, error: 'no test script found in package.json' });
    } else {
      process.stderr.write('No test script found in package.json (looked for: test, test:unit).\n');
    }
    return exitCodes.CHECK_FAILED;
  }

  if (flags.json) {
    const copy = { ...step };
    if (copy.stdout != null) copy.stdout = output.truncate(copy.stdout, 20000).text;
    if (copy.stderr != null) copy.stderr = output.truncate(copy.stderr, 20000).text;
    output.printJson({ command: 'test', ok: step.status === 'passed', step: copy });
    return step.status === 'passed' ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine } = output;
  printLine(formatStepLine(step));
  if (step.status === 'failed') printFailureDetail(step);

  return step.status === 'passed' ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

module.exports = { run };
