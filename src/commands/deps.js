'use strict';

const { resolveNodeContext } = require('../core/node-context');
const { reportNoProject } = require('./verify');
const runner = require('../core/runner');
const audit = require('../core/audit');
const output = require('../core/output');
const exitCodes = require('../core/exit-codes');

const OUTDATED_ARGS = {
  npm: ['outdated', '--json'],
  pnpm: ['outdated', '--format', 'json'],
  yarn: ['outdated', '--json'],
  bun: ['outdated'],
};

const AUDIT_ARGS = {
  npm: ['audit', '--json'],
  pnpm: ['audit', '--json'],
  yarn: ['audit', '--json'],
  bun: ['audit', '--json'],
};

async function gatherOnline(pmName, cwd) {
  const online = {};

  const outdatedArgs = OUTDATED_ARGS[pmName];
  if (outdatedArgs) {
    const result = await runner.run(pmName, outdatedArgs, { cwd, timeoutMs: 60000 });
    if (result.spawnFailed) {
      online.outdated = { supported: false, error: result.error };
    } else {
      const parsed = audit.parseOutdatedJson(result.stdout);
      online.outdated = parsed.parsed
        ? { supported: true, ...parsed }
        : { supported: true, parsed: false, raw: output.truncate(result.stdout || result.stderr, 4000).text };
    }
  }

  const auditArgs = AUDIT_ARGS[pmName];
  if (auditArgs) {
    const result = await runner.run(pmName, auditArgs, { cwd, timeoutMs: 60000 });
    if (result.spawnFailed) {
      online.audit = { supported: false, error: result.error };
    } else {
      const parsed = audit.parseAuditJson(result.stdout);
      online.audit = parsed.parsed
        ? { supported: true, vulnerabilities: parsed.vulnerabilities, raw: parsed.raw }
        : { supported: true, parsed: false, raw: output.truncate(result.stdout || result.stderr, 4000).text };
    }
  }

  return online;
}

async function run({ flags }) {
  const cwd = process.cwd();
  const ctx = resolveNodeContext(cwd);

  if (!ctx.ok) {
    return reportNoProject('deps', ctx, flags);
  }

  const depCount = Object.keys(ctx.pkgJson.dependencies || {}).length;
  const devDepCount = Object.keys(ctx.pkgJson.devDependencies || {}).length;

  const data = {
    packageManager: ctx.packageManager,
    dependencies: depCount,
    devDependencies: devDepCount,
  };

  if (flags.online) {
    data.online = await gatherOnline(ctx.packageManager.name, ctx.root);
  }

  // Local inspection (lockfile/dependency counts) always "succeeds" once we
  // get this far. --online only fails the command if it was asked for and
  // the package manager itself couldn't even be spawned (consistent with
  // `ait port`'s behavior when no port-inspection tool is available).
  const onlineUnavailable =
    data.online && !data.online.outdated?.supported && !data.online.audit?.supported;
  const ok = !onlineUnavailable;

  if (flags.json) {
    output.printJson({ command: 'deps', ok, ...data });
    return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
  }

  const { printLine, color } = output;
  printLine(`Package manager:   ${data.packageManager.name} (${data.packageManager.source})`);
  printLine(`Lockfiles found:   ${data.packageManager.lockfiles.join(', ') || '(none)'}`);
  if (data.packageManager.warning) {
    printLine(color.yellow(`WARNING: ${data.packageManager.warning}`));
  }
  printLine(`Dependencies:      ${data.dependencies}`);
  printLine(`Dev dependencies:  ${data.devDependencies}`);

  if (data.online) {
    printLine('');
    const { outdated, audit: auditResult } = data.online;
    if (outdated) {
      if (!outdated.supported) {
        printLine(`Outdated check:    unavailable (${outdated.error})`);
      } else if (outdated.parsed === false) {
        printLine('Outdated check:    (raw output, not fully parsed for this package manager)');
        printLine(outdated.raw);
      } else {
        printLine(`Outdated packages: ${outdated.count}`);
        for (const pkg of outdated.packages.slice(0, 40)) {
          printLine(`  ${pkg.name}  current=${pkg.current} wanted=${pkg.wanted} latest=${pkg.latest}`);
        }
      }
    }
    if (auditResult) {
      printLine('');
      if (!auditResult.supported) {
        printLine(`Security audit:    unavailable (${auditResult.error})`);
      } else if (auditResult.parsed === false) {
        printLine('Security audit:    (raw output, not fully parsed for this package manager)');
        printLine(auditResult.raw);
      } else if (auditResult.vulnerabilities) {
        const v = auditResult.vulnerabilities;
        printLine(
          `Security audit:    ${v.total ?? 0} vulnerabilities (critical=${v.critical ?? 0} high=${v.high ?? 0} moderate=${v.moderate ?? 0} low=${v.low ?? 0})`
        );
      } else {
        printLine('Security audit:    no vulnerability data returned');
      }
    }
  }

  return ok ? exitCodes.OK : exitCodes.CHECK_FAILED;
}

module.exports = { run };
