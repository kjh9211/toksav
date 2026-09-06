# CLAUDE.md

이 저장소를 조사하거나 검증할 때는 여러 shell 명령을 개별적으로 호출하는 대신 `ait` CLI를 우선 사용해 주세요.

- 저장소를 처음 살펴볼 때: `ait inspect` (project root, package manager, git 상태, 주요 파일, scripts, dependencies를 한 번에 확인)
- 코드 리뷰 전 변경 사항을 볼 때: `ait changed` (staged/unstaged/untracked, diff stat)
- git 상태를 자세히 볼 때: `ait git` (branch, upstream, ahead/behind, 최근 커밋)
- 빠르게 정적 검사만 할 때: `ait check` (lint + typecheck)
- 구현을 완료했다고 보고하기 전: `ait verify` (lint → typecheck → test → build 순서로 실행, 없는 script는 skip 처리되며 실패로 간주하지 않음)
- 환경 문제로 실패했을 때: `ait doctor` (node/npm/pnpm/yarn/bun/git/docker/java/maven/gradle 설치 여부 확인)
- 개발 서버를 띄우기 전: `ait port <port>` (포트 점유 여부 확인)
- 의존성 상태를 볼 때: `ait deps` (package manager/lockfile 일치 여부), network 조회가 꼭 필요할 때만 `--online` 추가
- 빌드 산출물을 정리할 때: 먼저 `ait clean --dry-run`으로 무엇이 지워질지 확인한 뒤 `ait clean` 실행

`ait`가 이미 처리하는 조사/검증을 중복해서 개별 명령으로 다시 수행하지 마세요. 추가 진단이 꼭 필요한 경우에만 별도 명령을 사용하세요.

모든 명령에 `--json`을 붙이면 stdout에 오직 JSON 한 덩어리만 출력됩니다 (파싱하기 쉽습니다). Exit code: `0` 성공, `1` 검사/명령 실패(SKIP은 실패 아님), `2` 잘못된 CLI 사용, `3` 프로젝트/git repository 감지 실패, `4` 내부 오류.

`ait`는 스스로 destructive한 작업을 하지 않습니다 (`git reset --hard`/`git clean -fd` 없음, 자동 commit/push/install 없음, 임의 shell 실행 없음, `clean`은 고정된 whitelist 안의 빌드 산출물 디렉터리만 삭제). 별도 확인 없이 안전하게 실행할 수 있습니다.
