'use strict';

const runner = require('./runner');
const platform = require('./platform');

function parseSsOutput(output, port) {
  const matches = [];
  for (const line of (output || '').split('\n')) {
    if (!line.includes('LISTEN')) continue;
    const fields = line.trim().split(/\s+/);
    const localField = fields.find((f) => f.endsWith(`:${port}`));
    if (!localField) continue;
    const userMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
    matches.push({
      pid: userMatch ? Number(userMatch[2]) : null,
      process: userMatch ? userMatch[1] : null,
      local: localField,
    });
  }
  return matches;
}

function parseLsofOutput(output) {
  const lines = (output || '').split('\n').filter(Boolean);
  const matches = [];
  for (const line of lines) {
    if (line.startsWith('COMMAND')) continue;
    const fields = line.trim().split(/\s+/);
    if (fields.length < 9) continue;
    const [command, pid, , , , , , , name] = fields;
    matches.push({ pid: Number(pid), process: command, local: name.replace(/\(LISTEN\)$/, '') });
  }
  return matches;
}

function parseNetstatOutput(output) {
  const matches = [];
  for (const line of (output || '').split('\n')) {
    const m = line.trim().match(/^TCP\s+(\S+)\s+(\S+)\s+LISTENING\s+(\d+)\s*$/i);
    if (m) {
      matches.push({ pid: Number(m[3]), process: null, local: m[1] });
    }
  }
  return matches;
}

function parseTasklistCsv(output) {
  const line = (output || '').split('\n').find((l) => l.trim().length > 0);
  if (!line) return null;
  const fields = line.split('","').map((f) => f.replace(/^"|"$/g, ''));
  return fields[0] || null;
}

async function findProcessesOnPort(port) {
  if (platform.isWindows()) {
    const netstat = await runner.run('netstat', ['-ano', '-p', 'TCP']);
    if (netstat.spawnFailed) {
      return { supported: false, matches: [], toolUsed: null };
    }
    const matches = parseNetstatOutput(netstat.stdout).filter((m) => m.local.endsWith(`:${port}`));
    for (const match of matches) {
      if (match.pid) {
        const tasklist = await runner.run('tasklist', ['/FI', `PID eq ${match.pid}`, '/FO', 'CSV', '/NH']);
        if (!tasklist.spawnFailed) {
          match.process = parseTasklistCsv(tasklist.stdout);
        }
      }
    }
    return { supported: true, matches, toolUsed: 'netstat' };
  }

  // Linux / macOS: prefer `ss` (Linux only, fast, no root needed for own procs),
  // fall back to `lsof` (available on both Linux and macOS).
  if (!platform.isMac()) {
    const ss = await runner.run('ss', ['-H', '-tlnp', `sport = :${port}`]);
    if (!ss.spawnFailed && ss.exitCode === 0) {
      const matches = parseSsOutput(ss.stdout, port);
      if (matches.length > 0 || ss.stdout.trim().length === 0) {
        return { supported: true, matches, toolUsed: 'ss' };
      }
    }
  }

  const lsof = await runner.run('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-n', '-P']);
  if (!lsof.spawnFailed) {
    return { supported: true, matches: parseLsofOutput(lsof.stdout), toolUsed: 'lsof' };
  }

  return { supported: false, matches: [], toolUsed: null };
}

module.exports = {
  parseSsOutput,
  parseLsofOutput,
  parseNetstatOutput,
  parseTasklistCsv,
  findProcessesOnPort,
};
