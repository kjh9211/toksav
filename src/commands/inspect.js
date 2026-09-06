'use strict';

const path = require('path');
const { existsAny, listTopLevel } = require('../core/fs-utils');
const project = require('../core/project');
const packageManager = require('../core/package-manager');
const platform = require('../core/platform');
const git = require('../core/git');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

const KEY_FILE_GROUPS = [
  { label: 'package.json', names: ['package.json'] },
  { label: 'tsconfig.json', names: ['tsconfig.json'] },
  {
    label: 'eslint config',
    names: [
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc.yaml',
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
    ],
  },
  {
    label: 'prettier config',
    names: [
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.js',
      '.prettierrc.cjs',
      '.prettierrc.yml',
      '.prettierrc.yaml',
      'prettier.config.js',
      'prettier.config.cjs',
    ],
  },
  { label: 'Dockerfile', names: ['Dockerfile'] },
  { label: 'docker-compose', names: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'] },
  { label: 'README', names: ['README.md', 'README', 'readme.md'] },
  { label: 'AGENTS.md', names: ['AGENTS.md'] },
  { label: 'CLAUDE.md', names: ['CLAUDE.md'] },
];

const MAX_DEPS_LISTED = 40;

function summarizeDeps(deps) {
  if (!deps) return { count: 0, names: [] };
  const entries = Object.entries(deps);
  return {
    count: entries.length,
    names: entries.slice(0, MAX_DEPS_LISTED).map(([name, version]) => `${name}@${version}`),
    truncated: entries.length > MAX_DEPS_LISTED,
  };
}

async function gather(cwd) {
  const { root, type } = project.detectProject(cwd);
  const pkgJson = type === 'node' ? project.readPackageJson(root) : null;
  const pm = type === 'node' ? packageManager.detect(root, pkgJson) : null;

  const isRepo = await git.isGitRepo(cwd);
  let gitInfo = null;
  if (isRepo) {
    const status = await git.getStatus(cwd);
    const commits = await git.getRecentCommits(cwd, 5);
    gitInfo = {
      branch: status.branch,
      detached: status.detached,
      staged: status.staged.length,
      unstaged: status.unstaged.length,
      untracked: status.untracked.length,
      unmerged: status.unmerged.length,
      recentCommits: commits,
    };
  }

  const keyFiles = KEY_FILE_GROUPS.map((group) => ({
    label: group.label,
    present: existsAny(root, group.names).length > 0,
  }));

  const topLevel = listTopLevel(root).map((entry) => (entry.type === 'dir' ? `${entry.name}/` : entry.name));

  return {
    cwd,
    projectRoot: root,
    projectType: type,
    os: platform.summary(),
    node: process.version,
    packageManager: pm,
    git: { isRepo, ...(gitInfo || {}) },
    keyFiles,
    topLevel,
    scripts: pkgJson ? pkgJson.scripts || {} : null,
    dependencies: pkgJson ? summarizeDeps(pkgJson.dependencies) : null,
    devDependencies: pkgJson ? summarizeDeps(pkgJson.devDependencies) : null,
  };
}

function printHuman(data) {
  const { printLine, color } = output;
  printLine(`Working directory: ${data.cwd}`);
  printLine(`Project root:      ${data.projectRoot} (${data.projectType})`);
  printLine(`OS:                ${data.os.platform} ${data.os.arch} (${data.os.release})`);
  printLine(`Node.js:           ${data.node}`);
  if (data.packageManager) {
    printLine(`Package manager:   ${data.packageManager.name} (${data.packageManager.source})`);
    if (data.packageManager.warning) {
      printLine(color.yellow(`  WARNING: ${data.packageManager.warning}`));
    }
  }
  printLine('');

  if (!data.git.isRepo) {
    printLine('Git repository:    no');
  } else {
    printLine('Git repository:    yes');
    printLine(`Branch:            ${data.git.detached ? '(detached HEAD)' : data.git.branch || '(unborn)'}`);
    printLine(`Status:            ${data.git.staged} staged, ${data.git.unstaged} unstaged, ${data.git.untracked} untracked`);
    printLine('Recent commits:');
    if (data.git.recentCommits.length === 0) {
      printLine('  (no commits yet)');
    } else {
      for (const c of data.git.recentCommits) {
        printLine(`  ${c.hash} ${c.subject} (${c.author}, ${c.relativeDate})`);
      }
    }
  }
  printLine('');

  printLine('Key files:');
  for (const f of data.keyFiles) {
    printLine(`  ${f.label.padEnd(20)} ${f.present ? 'yes' : 'no'}`);
  }
  printLine('');

  printLine('Top-level structure:');
  for (const entry of data.topLevel) {
    printLine(`  ${entry}`);
  }
  printLine('');

  if (data.scripts) {
    const scriptEntries = Object.entries(data.scripts);
    printLine(`package.json scripts (${scriptEntries.length}):`);
    for (const [name, cmd] of scriptEntries) {
      printLine(`  ${name}: ${cmd}`);
    }
    printLine('');

    printLine(`Dependencies (${data.dependencies.count}):`);
    for (const name of data.dependencies.names) printLine(`  ${name}`);
    if (data.dependencies.truncated) printLine(`  ... (${data.dependencies.count - MAX_DEPS_LISTED} more)`);
    printLine('');

    printLine(`Dev dependencies (${data.devDependencies.count}):`);
    for (const name of data.devDependencies.names) printLine(`  ${name}`);
    if (data.devDependencies.truncated) printLine(`  ... (${data.devDependencies.count - MAX_DEPS_LISTED} more)`);
  }
}

async function run({ flags }) {
  const cwd = process.cwd();
  const data = await gather(cwd);

  if (flags.json) {
    output.printJson({ command: 'inspect', ok: true, ...data });
  } else {
    printHuman(data);
  }
  return exitCodes.OK;
}

module.exports = { run, gather };
