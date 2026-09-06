'use strict';

const tools = require('../core/tools');
const platform = require('../core/platform');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

async function run({ flags }) {
  const os = platform.summary();
  const results = await tools.probeAll();

  if (flags.json) {
    output.printJson({ command: 'doctor', ok: true, os, tools: results });
    return exitCodes.OK;
  }

  const { printLine, color } = output;
  printLine(`OS         ${os.platform} ${os.arch} (${os.release})`);
  for (const tool of results) {
    const value = tool.installed ? tool.version : color.yellow('NOT INSTALLED');
    printLine(`${tool.name.padEnd(10)} ${value}`);
  }

  return exitCodes.OK;
}

module.exports = { run };
