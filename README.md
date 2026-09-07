# ait

AI coding agent(Claude Code, Codex 등)가 프로젝트 상태를 빠르게 파악하고, 적은 tool call로 검증할 수 있도록 만든 CLI입니다.

`git status`, 프로젝트 구조 파악, lint/typecheck/test/build, dependency 점검, 포트 점유 확인, 개발 환경 점검처럼 반복적으로 필요한 조사/검증 작업을 각각 하나의 명령으로 끝낼 수 있습니다.

## 설치

### 로컬 개발 중 직접 실행

```bash
npm install
node bin/ait.js inspect
node bin/ait.js verify
```

### global CLI로 설치

이 저장소를 global로 링크하면 `ait` 명령을 어디서나 사용할 수 있습니다.

```bash
npm install
npm link
ait inspect
```

또는 npm 레지스트리에 배포된 경우:

```bash
npm install -g ait
```

요구 사항: Node.js 20 이상.

## 명령 목록

| 명령 | 설명 |
| --- | --- |
| `ait inspect` | 프로젝트 개요(root, git, 주요 파일, scripts, deps)를 한 번에 수집 |
| `ait verify` | lint → typecheck → test → build 순서로 전체 검증 (감지 안 된 script는 skip) |
| `ait check` | lint + typecheck만 빠르게 실행 |
| `ait test [-- ...args]` | 테스트 스크립트 실행, `--`로 추가 인자 전달 |
| `ait build [-- ...args]` | build 스크립트 실행 |
| `ait git` | 브랜치/upstream/ahead-behind/staged/unstaged/untracked/최근 커밋을 한 번에 표시 |
| `ait changed` | 커밋 전 리뷰용 변경 파일 요약 (staged/unstaged/untracked + diff stat) |
| `ait deps` | package manager/lockfile 점검, `--online`으로 outdated/audit 조회 |
| `ait port <port>` | 해당 포트를 점유 중인 프로세스(PID/이름) 조회 |
| `ait doctor` | node/npm/pnpm/yarn/bun/git/docker/java/maven/gradle 설치 여부 및 버전 점검 |
| `ait clean` | 빌드 산출물/캐시 정리 (whitelist 기반, 기본은 dry 아님이지만 안전한 대상만) |

공통 옵션: `--json`, `--help`/`-h`, `--version`/`-v`

명령별 옵션:

- `ait verify --fail-fast` : 첫 실패 단계에서 나머지 단계를 skip
- `ait verify|check|test|build --timeout <ms>` : 각 단계에 timeout(ms) 적용, 초과 시 프로세스 트리 전체를 종료
- `ait changed --diff` : 변경 요약 뒤에 실제 diff까지 출력 (기본은 토큰 절약을 위해 diff 본문을 출력하지 않음)
- `ait deps --online` : network를 사용하는 outdated/audit 조회 포함 (기본은 로컬 정보만)
- `ait clean --dry-run` : 실제로 삭제하지 않고 무엇을 지울지만 출력
- `ait clean --deps` : `node_modules` 삭제도 허용 (기본은 제외)

## 프로젝트 자동 감지

- package manager: `package.json#packageManager` 필드를 최우선으로 하고, 없으면 lockfile(`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`/`bun.lock`, `package-lock.json`)로 판단하며, 둘 다 없으면 `npm`을 기본값으로 사용합니다. 선언과 lockfile이 다르면 경고를 출력합니다.
- script 감지: 아래 우선순위로 이름을 찾고, 없으면 해당 단계를 skip합니다 (임의의 script를 추측해서 실행하지 않습니다).
  - lint: `lint` → `eslint`
  - typecheck: `typecheck` → `type-check` → `check-types` → `tsc`
  - test: `test` → `test:unit`
  - build: `build`
- 프로젝트 타입: `package.json`이 있으면 Node 프로젝트로 보고 모든 명령을 완전히 지원합니다. `pom.xml`(Maven), `build.gradle`/`build.gradle.kts`/`settings.gradle`(Gradle)은 존재를 감지해 `inspect`/`doctor`에 반영하지만, `verify`/`check`/`test`/`build`의 실제 실행은 아직 지원하지 않습니다(추후 확장 가능한 구조로만 구현).

## AI agent와 함께 사용하기

이 CLI의 1차 사용자는 AI coding agent입니다. 그래서 출력은 다음 특성을 갖도록 설계했습니다.

- deterministic하고 간결하며, 중요한 정보가 먼저 나옵니다.
- spinner/progress animation이 없습니다.
- ANSI color는 TTY에서만 사용하고, 파이프/CI 환경(`CI` 환경변수, `NO_COLOR`)에서는 자동으로 plain text가 됩니다.
- 실패 시 실제로 실행한 command, exit code, stderr/stdout을 함께 출력합니다.

### JSON 출력

모든 명령은 `--json`으로 기계가 파싱하기 쉬운 JSON을 stdout에 한 덩어리로만 출력합니다. 진단 메시지가 필요하면 stderr로 보내고, stdout에는 JSON 이외의 텍스트를 섞지 않습니다.

```bash
ait verify --json
```

```json
{
  "command": "verify",
  "ok": false,
  "durationMs": 12442,
  "steps": [
    { "name": "lint", "status": "passed", "exitCode": 0, "durationMs": 2124 },
    { "name": "typecheck", "status": "skipped", "reason": "script not found" },
    { "name": "test", "status": "passed", "exitCode": 0, "durationMs": 4412 },
    { "name": "build", "status": "failed", "exitCode": 1, "durationMs": 5906 }
  ]
}
```

### Exit code

| code | 의미 |
| --- | --- |
| 0 | 성공 / 모든 검사 통과 (SKIP은 실패로 간주하지 않습니다) |
| 1 | 검사 또는 명령 실패 |
| 2 | 잘못된 CLI 사용 (알 수 없는 명령/옵션, 잘못된 인자) |
| 3 | 프로젝트(또는 git repository) 감지 실패 |
| 4 | 내부 오류 |
| 130 | Ctrl+C(SIGINT)로 중단됨 |

### 에이전트 설정 예시

`AGENTS.md`, `CLAUDE.md`에 아래와 같은 지침을 추가해 두면 에이전트가 반복적인 shell 명령 대신 `ait`를 우선 사용하도록 유도할 수 있습니다. 이 저장소에도 예시가 포함되어 있습니다 (`AGENTS.md`, `CLAUDE.md` 참고).

## 안전 정책

이 CLI는 AI agent가 자동으로 실행할 수 있다는 전제로 설계했습니다.

1. 기본 명령은 destructive operation을 하지 않습니다.
2. `git reset --hard`, `git clean -fd`를 사용하지 않습니다.
3. 자동으로 commit/push하지 않습니다.
4. 자동으로 package를 install하지 않습니다 (`deps --online`도 조회만 하며 설치하지 않습니다).
5. `clean`은 `dist`, `build`, `.next`, `coverage`, `.turbo`라는 명확한 whitelist 안의 경로만 삭제하며, 프로젝트 root/`.git`/`src`/`node_modules`는 (명시적 `--deps` 없이는) 절대 삭제하지 않습니다. 경로 traversal이나 심볼릭 링크를 통한 우회도 차단합니다.
6. shell command를 문자열 결합으로 만들지 않고, 항상 argv 배열로 전달합니다. 프로세스 실행에는 [`cross-spawn`](https://www.npmjs.com/package/cross-spawn)을 사용하는데, Windows에서 `npm`/`pnpm`/`yarn`/`bun`/`mvn`/`gradle`이 `.cmd`/`.bat`로 배포되어 `cmd.exe`를 거쳐야만 실행 가능하기 때문입니다. Node의 `child_process.spawn`에 `shell: true`와 argv 배열을 함께 쓰면 인자가 제대로 escape되지 않는데(Node가 `DEP0190`으로 이 조합 자체를 deprecate했습니다), `cross-spawn`은 필요한 경우에만 내부적으로 `cmd.exe`를 거치면서 각 인자를 올바르게 escape하므로 `ait test -- <인자>`처럼 사용자가 넘긴 값이 별도 명령으로 해석되지 않습니다.
7. 임의의 shell command를 실행하는 기능은 제공하지 않습니다.
8. `Ctrl+C`(SIGINT)를 처리해 실행 중이던 프로세스 트리 전체(패키지 매니저가 내부적으로 띄운 shell/자식 프로세스 포함)를 정리한 뒤 종료합니다.

## 개발

```bash
npm test          # node --test 기반 테스트 실행
node bin/ait.js --help
```

테스트는 임시 디렉터리(`os.tmpdir()`)에서만 파일을 만들고 지우며, 실제 사용자 저장소를 건드리지 않습니다.

## 알려진 제한 사항

- Maven/Gradle 프로젝트는 감지만 하고, `verify`/`test`/`build` 등의 실제 실행은 아직 지원하지 않습니다.
- `deps --online`의 outdated/audit 결과는 npm/pnpm에 대해서만 구조화된 형태로 파싱하고, yarn(classic)/bun은 원본 출력을 그대로 보여줍니다 (해당 도구들의 출력 형식이 단일 JSON이 아니기 때문입니다).
- `ait port`는 Linux에서 `ss`(없으면 `lsof`), macOS에서 `lsof`, Windows에서 `netstat`을 사용합니다. 해당 도구가 없는 환경에서는 조회에 실패할 수 있습니다.
