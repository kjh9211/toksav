'use strict';

const git = require('../core/git');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

async function gather(cwd, { includeDiff } = {}) {
  const isRepo = await git.isGitRepo(cwd);
  if (!isRepo) return { isRepo: false };

  const status = await git.getStatus(cwd);
  const diffStat = await git.getDiffStat(cwd);
  const diff = includeDiff ? await git.getDiff(cwd) : null;

  return {
    isRepo: true,
    staged: status.staged,
    unstaged: status.unstaged,
    untracked: status.untracked,
    diffStat,
    diff,
  };
}

function printHuman(data, { includeDiff }) {
  const { printLine } = output;
  if (!data.isRepo) {
    printLine('Not a git repository.');
    return;
  }

  printLine('Changed files');
  printLine('');

  printLine('STAGED');
  if (data.staged.length === 0) printLine('  (none)');
  for (const f of data.staged) printLine(`${f.status} ${f.path}`);
  printLine('');

  printLine('UNSTAGED');
  if (data.unstaged.length === 0) printLine('  (none)');
  for (const f of data.unstaged) printLine(`${f.status} ${f.path}`);
  printLine('');

  printLine('UNTRACKED');
  if (data.untracked.length === 0) printLine('  (none)');
  for (const f of data.untracked) printLine(f);
  printLine('');

  const totalFiles = data.staged.length + data.unstaged.length + data.untracked.length;
  printLine(`${totalFiles} files changed`);
  printLine(`+${data.diffStat.insertions} -${data.diffStat.deletions}`);

  if (includeDiff && data.diff) {
    printLine('');
    printLine('--- diff ---');
    printLine(data.diff);
  }
}

async function run({ flags }) {
  const cwd = process.cwd();
  const includeDiff = Boolean(flags.diff);
  const data = await gather(cwd, { includeDiff });

  if (flags.json) {
    output.printJson({ command: 'changed', ok: data.isRepo, ...data });
  } else {
    printHuman(data, { includeDiff });
  }

  return data.isRepo ? exitCodes.OK : exitCodes.PROJECT_NOT_DETECTED;
}

module.exports = { run, gather };
