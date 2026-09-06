'use strict';

const BOOLEAN_FLAGS = new Set(['json', 'failFast', 'diff', 'online', 'dryRun', 'deps', 'help']);

const FLAG_ALIASES = {
  '--json': 'json',
  '--fail-fast': 'failFast',
  '--diff': 'diff',
  '--online': 'online',
  '--dry-run': 'dryRun',
  '--deps': 'deps',
  '--help': 'help',
  '-h': 'help',
};

/**
 * Minimal, dependency-free argv parser for a fixed set of commands/flags.
 * Everything after a literal `--` is collected verbatim into `extraArgs`
 * (never re-parsed as flags) so it can be forwarded to the underlying
 * package-manager script untouched.
 */
function parseArgs(argv) {
  const result = { command: null, flags: {}, positional: [], extraArgs: [], unknownFlags: [] };

  if (argv.length === 0) {
    result.command = 'help';
    return result;
  }

  const first = argv[0];
  if (first === '--help' || first === '-h') {
    result.command = 'help';
    return result;
  }
  if (first === '--version' || first === '-v') {
    result.command = 'version';
    return result;
  }

  result.command = first;
  let sawDashDash = false;

  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];

    if (sawDashDash) {
      result.extraArgs.push(token);
      continue;
    }
    if (token === '--') {
      sawDashDash = true;
      continue;
    }
    if (FLAG_ALIASES[token]) {
      result.flags[FLAG_ALIASES[token]] = true;
      continue;
    }
    if (token === '--timeout') {
      const value = argv[++i];
      result.flags.timeout = value ? Number(value) : NaN;
      continue;
    }
    if (token.startsWith('--timeout=')) {
      result.flags.timeout = Number(token.slice('--timeout='.length));
      continue;
    }
    if (token.startsWith('-')) {
      result.unknownFlags.push(token);
      continue;
    }
    result.positional.push(token);
  }

  return result;
}

module.exports = { parseArgs, BOOLEAN_FLAGS, FLAG_ALIASES };
