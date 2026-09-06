'use strict';

const path = require('path');
const { parseArgs } = require('./core/args');
const exitCodes = require('./core/exit-codes');
const runner = require('./core/runner');
const output = require('./core/output');

const COMMANDS = {
  inspect: () => require('./commands/inspect'),
  verify: () => require('./commands/verify'),
  check: () => require('./commands/check'),
  test: () => require('./commands/test'),
  build: () => require('./commands/build'),
  git: () => require('./commands/git'),
  changed: () => require('./commands/changed'),
  deps: () => require('./commands/deps'),
  port: () => require('./commands/port'),
  doctor: () => require('./commands/doctor'),
  clean: () => require('./commands/clean'),
};

const HELP_TEXT = `ait - AI coding agent를 위한 프로젝트 조사/검증 CLI

Usage: ait <command> [options] [-- extra args]

Commands:
  inspect              프로젝트 개요를 한 번에 수집 (root, git, 주요 파일, scripts, deps)
  verify               lint -> typecheck -> test -> build 순서로 전체 검증
  check                lint + typecheck만 빠르게 실행
  test [-- ...args]    테스트 스크립트 실행 (추가 인자 전달 가능)
  build [-- ...args]   build 스크립트 실행
  git                  git 상태(브랜치/staged/unstaged/untracked/커밋)를 한 번에 표시
  changed              커밋 전 리뷰용 변경 파일 요약 (staged/unstaged/untracked)
  deps                 의존성/lockfile 점검 (--online 시 outdated/audit 조회)
  port <port>          해당 포트를 점유 중인 프로세스 조회
  doctor               개발 환경에 설치된 도구 버전 점검
  clean                빌드 산출물/캐시 정리 (whitelist 기반, --dry-run 지원)

Global options:
  --json               사람이 읽는 출력 대신 JSON 한 덩어리를 stdout에 출력
  --help, -h            도움말 출력
  --version, -v         버전 출력

Command-specific options:
  verify --fail-fast          첫 실패 단계에서 나머지 단계를 건너뜀
  verify/check/test/build --timeout <ms>   각 단계에 timeout(ms) 적용
  changed --diff               변경 요약 뒤에 실제 diff도 출력
  deps --online                 network를 사용하는 outdated/audit 조회 포함
  clean --dry-run               실제로 삭제하지 않고 대상만 출력
  clean --deps                  node_modules 삭제도 허용 (기본은 제외)

Exit codes:
  0  성공 / 모든 검사 통과
  1  검사 또는 명령 실패
  2  잘못된 CLI 사용
  3  프로젝트(또는 git repository) 감지 실패
  4  내부 오류
  130 Ctrl+C로 중단됨

Examples:
  ait inspect
  ait verify --json
  ait test -- --runInBand
  ait port 3000
`;

function printHelp() {
  process.stdout.write(HELP_TEXT);
}

function printVersion() {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  process.stdout.write(`${pkg.version}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);

  if (parsed.command === 'help') {
    printHelp();
    return exitCodes.OK;
  }
  if (parsed.command === 'version') {
    printVersion();
    return exitCodes.OK;
  }

  if (parsed.flags.help) {
    // Even --help must keep stdout pure JSON when --json is set, so an
    // agent that always parses stdout as JSON doesn't choke on this path.
    if (parsed.flags.json) {
      output.printJson({ command: parsed.command || 'help', ok: true, help: HELP_TEXT });
    } else {
      printHelp();
    }
    return exitCodes.OK;
  }

  const factory = COMMANDS[parsed.command];
  if (!factory) {
    if (parsed.flags.json) {
      output.printJson({ command: parsed.command, ok: false, error: `unknown command: "${parsed.command}"` });
    } else {
      process.stderr.write(`Unknown command: "${parsed.command}"\n\n`);
      printHelp();
    }
    return exitCodes.USAGE_ERROR;
  }

  if (parsed.unknownFlags.length > 0) {
    if (parsed.flags.json) {
      output.printJson({ command: parsed.command, ok: false, error: `unknown option(s): ${parsed.unknownFlags.join(', ')}` });
    } else {
      process.stderr.write(`Unknown option(s): ${parsed.unknownFlags.join(', ')}\n`);
    }
    return exitCodes.USAGE_ERROR;
  }

  if (parsed.flags.timeout !== undefined && (Number.isNaN(parsed.flags.timeout) || parsed.flags.timeout <= 0)) {
    if (parsed.flags.json) {
      output.printJson({ command: parsed.command, ok: false, error: 'invalid --timeout value: expected a positive number of milliseconds' });
    } else {
      process.stderr.write('Invalid --timeout value: expected a positive number of milliseconds.\n');
    }
    return exitCodes.USAGE_ERROR;
  }

  const mod = factory();
  return mod.run({ flags: parsed.flags, positional: parsed.positional, extraArgs: parsed.extraArgs });
}

let interrupted = false;
process.on('SIGINT', () => {
  if (interrupted) {
    process.exit(exitCodes.INTERRUPTED);
    return;
  }
  interrupted = true;
  // Set this eagerly: whichever child dies first (killed cleanly vs. still
  // shutting down when the fallback below fires), the reported exit code
  // must consistently mean "interrupted", not whatever the killed command's
  // own exit code happened to be.
  process.exitCode = exitCodes.INTERRUPTED;
  process.stderr.write('\nInterrupted (SIGINT).\n');
  runner.killAll('SIGINT');
  // Hard-exit fallback in case something still hangs. runner's own cleanup
  // kills one process-tree depth level at a time (each level up to ~500ms),
  // so this is set comfortably past a few levels of depth rather than a
  // single kill, letting that cleanup finish before this force-exit would
  // otherwise cut it off.
  setTimeout(() => process.exit(exitCodes.INTERRUPTED), 3000).unref();
});

main()
  .then((code) => {
    if (!interrupted) process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`Internal error: ${err && err.stack ? err.stack : err}\n`);
    if (!interrupted) process.exitCode = exitCodes.INTERNAL_ERROR;
  });
