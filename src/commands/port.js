'use strict';

const ports = require('../core/ports');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

function parsePort(value) {
  if (!/^\d+$/.test(String(value || ''))) return null;
  const port = Number(value);
  if (port < 1 || port > 65535) return null;
  return port;
}

async function run({ positional, flags }) {
  const { printLine } = output;
  const portArg = positional[0];
  const port = parsePort(portArg);

  if (port === null) {
    if (portArg === undefined) {
      process.stderr.write('Usage: ait port <port>\n');
    } else {
      process.stderr.write(`Invalid port: "${portArg}". Expected an integer between 1 and 65535.\n`);
    }
    return exitCodes.USAGE_ERROR;
  }

  const { supported, matches, toolUsed } = await ports.findProcessesOnPort(port);

  if (!supported) {
    if (flags.json) {
      output.printJson({ command: 'port', ok: false, port, error: 'no supported port-inspection tool found on this platform' });
    } else {
      process.stderr.write('Could not determine port usage: no supported tool (ss/lsof/netstat) found.\n');
    }
    return exitCodes.CHECK_FAILED;
  }

  const inUse = matches.length > 0;

  if (flags.json) {
    output.printJson({ command: 'port', ok: true, port, inUse, tool: toolUsed, matches });
    return exitCodes.OK;
  }

  if (!inUse) {
    printLine(`Port ${port} is available.`);
    return exitCodes.OK;
  }

  printLine(`Port ${port} is in use.`);
  for (const m of matches) {
    printLine('');
    printLine(`PID: ${m.pid ?? '(unknown)'}`);
    printLine(`Process: ${m.process ?? '(unknown)'}`);
    printLine(`Local: ${m.local}`);
  }
  return exitCodes.OK;
}

module.exports = { run, parsePort };
