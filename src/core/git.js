'use strict';

const runner = require('./runner');

/**
 * Parse `git status --porcelain=v2 --branch` output into a structured object.
 * The v2 porcelain format has a stable, well-documented field layout, which
 * is why we use it instead of the plain `--porcelain` (v1) format.
 */
function parsePorcelainV2(output) {
  const result = {
    branch: null,
    detached: false,
    initial: false,
    oid: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    ignored: [],
    unmerged: [],
  };

  if (!output) return result;

  const lines = output.split('\n').filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.startsWith('# branch.oid ')) {
      const value = line.slice('# branch.oid '.length);
      result.oid = value;
      result.initial = value === '(initial)';
    } else if (line.startsWith('# branch.head ')) {
      const value = line.slice('# branch.head '.length);
      result.detached = value === '(detached)';
      result.branch = result.detached ? null : value;
    } else if (line.startsWith('# branch.upstream ')) {
      result.upstream = line.slice('# branch.upstream '.length);
    } else if (line.startsWith('# branch.ab ')) {
      const match = line.match(/\+(\d+) -(\d+)/);
      if (match) {
        result.ahead = Number(match[1]);
        result.behind = Number(match[2]);
      }
    } else if (line.startsWith('1 ')) {
      const m = line.match(/^1 (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (.+)$/);
      if (m) {
        const [, xy, , , , , , , filePath] = m;
        addOrdinary(result, xy, filePath);
      }
    } else if (line.startsWith('2 ')) {
      const m = line.match(/^2 (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (.+)$/);
      if (m) {
        const [, xy, , , , , , , , rest] = m;
        const [filePath, origPath] = rest.split('\t');
        addOrdinary(result, xy, filePath, origPath);
      }
    } else if (line.startsWith('u ')) {
      const m = line.match(/^u (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (.+)$/);
      if (m) {
        const [, xy, , , , , , , , , filePath] = m;
        result.unmerged.push({ status: xy, path: filePath });
      }
    } else if (line.startsWith('? ')) {
      result.untracked.push(line.slice(2));
    } else if (line.startsWith('! ')) {
      result.ignored.push(line.slice(2));
    }
  }

  return result;
}

function addOrdinary(result, xy, filePath, origPath) {
  const staged = xy[0];
  const unstaged = xy[1];
  if (staged !== '.') {
    result.staged.push({ status: staged, path: filePath, origPath: origPath || null });
  }
  if (unstaged !== '.') {
    result.unstaged.push({ status: unstaged, path: filePath, origPath: origPath || null });
  }
}

/** Parse `git diff --shortstat` output like:
 *   " 3 files changed, 82 insertions(+), 21 deletions(-)"
 * into { filesChanged, insertions, deletions }.
 */
function parseShortStat(output) {
  const stat = { filesChanged: 0, insertions: 0, deletions: 0 };
  if (!output) return stat;
  const filesMatch = output.match(/(\d+) files? changed/);
  const insMatch = output.match(/(\d+) insertions?\(\+\)/);
  const delMatch = output.match(/(\d+) deletions?\(-\)/);
  if (filesMatch) stat.filesChanged = Number(filesMatch[1]);
  if (insMatch) stat.insertions = Number(insMatch[1]);
  if (delMatch) stat.deletions = Number(delMatch[1]);
  return stat;
}

async function isGitRepo(cwd) {
  const result = await runner.run('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  return !result.spawnFailed && result.exitCode === 0 && result.stdout.trim() === 'true';
}

async function hasHead(cwd) {
  const result = await runner.run('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd });
  return result.exitCode === 0;
}

async function getStatus(cwd) {
  const result = await runner.run('git', ['status', '--porcelain=v2', '--branch'], { cwd });
  if (result.exitCode !== 0) {
    return { error: result.stderr.trim() || 'git status failed', ...parsePorcelainV2('') };
  }
  return parsePorcelainV2(result.stdout);
}

async function getDiffStat(cwd) {
  const headExists = await hasHead(cwd);
  const args = headExists ? ['diff', 'HEAD', '--shortstat'] : ['diff', '--cached', '--shortstat'];
  const result = await runner.run('git', args, { cwd });
  if (result.exitCode !== 0) return parseShortStat('');
  return parseShortStat(result.stdout);
}

async function getDiff(cwd, { cached } = {}) {
  const headExists = await hasHead(cwd);
  let args;
  if (cached) {
    args = ['diff', '--cached'];
  } else if (headExists) {
    args = ['diff', 'HEAD'];
  } else {
    args = ['diff', '--cached'];
  }
  const result = await runner.run('git', args, { cwd });
  return result.stdout;
}

async function getRecentCommits(cwd, count = 5) {
  const headExists = await hasHead(cwd);
  if (!headExists) return [];
  const result = await runner.run(
    'git',
    ['log', `-${count}`, '--pretty=format:%h%x1f%s%x1f%an%x1f%ar'],
    { cwd }
  );
  if (result.exitCode !== 0 || !result.stdout.trim()) return [];
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, author, relativeDate] = line.split('\x1f');
      return { hash, subject, author, relativeDate };
    });
}

module.exports = {
  parsePorcelainV2,
  parseShortStat,
  isGitRepo,
  hasHead,
  getStatus,
  getDiffStat,
  getDiff,
  getRecentCommits,
};
