'use strict';

const git = require('../core/git');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

async function gather(cwd) {
  const isRepo = await git.isGitRepo(cwd);
  if (!isRepo) return { isRepo: false };

  const status = await git.getStatus(cwd);
  const diffStat = await git.getDiffStat(cwd);
  const commits = await git.getRecentCommits(cwd, 10);

  return {
    isRepo: true,
    branch: status.branch,
    detached: status.detached,
    initial: status.initial,
    upstream: status.upstream,
    ahead: status.ahead,
    behind: status.behind,
    staged: status.staged,
    unstaged: status.unstaged,
    untracked: status.untracked,
    unmerged: status.unmerged,
    diffStat,
    recentCommits: commits,
  };
}

function printHuman(data) {
  const { printLine } = output;
  if (!data.isRepo) {
    printLine('Not a git repository.');
    return;
  }

  printLine(`Branch:    ${data.detached ? '(detached HEAD)' : data.branch || '(unborn)'}`);
  printLine(`Upstream:  ${data.upstream || '(none)'}`);
  if (data.upstream) {
    printLine(`Ahead/behind: +${data.ahead} / -${data.behind}`);
  }
  printLine('');

  printLine(`Staged (${data.staged.length}):`);
  for (const f of data.staged) printLine(`  ${f.status} ${f.path}`);

  printLine(`Modified (${data.unstaged.length}):`);
  for (const f of data.unstaged) printLine(`  ${f.status} ${f.path}`);

  printLine(`Untracked (${data.untracked.length}):`);
  for (const f of data.untracked) printLine(`  ${f}`);

  if (data.unmerged.length > 0) {
    printLine(`Unmerged (${data.unmerged.length}):`);
    for (const f of data.unmerged) printLine(`  ${f.status} ${f.path}`);
  }
  printLine('');

  printLine(`Diff stat: ${data.diffStat.filesChanged} files changed, +${data.diffStat.insertions} -${data.diffStat.deletions}`);
  printLine('');

  printLine('Recent commits:');
  if (data.recentCommits.length === 0) {
    printLine('  (no commits yet)');
  } else {
    for (const c of data.recentCommits) {
      printLine(`  ${c.hash} ${c.subject} (${c.author}, ${c.relativeDate})`);
    }
  }
}

async function run({ flags }) {
  const cwd = process.cwd();
  const data = await gather(cwd);

  if (flags.json) {
    output.printJson({ command: 'git', ok: data.isRepo, ...data });
  } else {
    printHuman(data);
  }

  return data.isRepo ? exitCodes.OK : exitCodes.PROJECT_NOT_DETECTED;
}

module.exports = { run, gather };
