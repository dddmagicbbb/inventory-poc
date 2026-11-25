# Verification — 검증

> 작성일: 2026-11-24
> 이 문서는 **안내**다. 검증 규칙의 원본은 아래 스크립트와 워크플로이며, 문서와 스크립트가 다르면 **스크립트가 맞다.**
> 원본 지정의 근거: [`SSOT.md`](SSOT.md) §5 "스크립트가 원본이 되고, 문서는 그 스크립트를 가리키는 안내만 둔다"

---

## 0. 통과 기준

```bash
npm run verify
```

**종료 코드 0이면 통과, 그 밖에는 실패다.** 로컬과 CI가 같은 명령을 실행한다.
한 단계라도 실패하면 그 자리에서 멈추고 다음 단계는 실행되지 않는다.

---

## 1. 원본 위치

| 무엇 | 원본 |
|---|---|
| 단계와 실행 순서 | [`package.json`](../../package.json) `scripts.verify` |
| 각 단계의 명령 | [`package.json`](../../package.json) `scripts` 의 `verify:prepare` · `typecheck` · `lint` · `check:architecture` · `test` · `build` |
| 검증 DB 위치 | [`scripts/verify-db.ts`](../../scripts/verify-db.ts) |
| CI 실행 조건 · 환경 | [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml) |

---

## 2. 단계

| # | 단계 | npm 스크립트 | 검사 내용 · 구현 | 근거 원본 |
|---|---|---|---|---|
| 1 | **Prepare** | `verify:prepare` | 검증 DB를 지우고 마이그레이션 → Prisma 클라이언트 생성 → 시드 · [`scripts/verify-prepare.ts`](../../scripts/verify-prepare.ts) | — |
| 2 | **Types** | `typecheck` | `tsc --noEmit` · 설정 [`tsconfig.json`](../../tsconfig.json) | — |
| 3 | **Lint** | `lint` | ESLint (Next.js core-web-vitals · typescript) · 설정 [`eslint.config.mjs`](../../eslint.config.mjs) | — |
| 4 | **Architecture** | `check:architecture` | 재고 변경이 `applyMovement()`만 거치는지 구문 분석 · [`scripts/check-architecture.ts`](../../scripts/check-architecture.ts) | [06](../06-architecture.md) §2 "규칙 하나" · §4.1 |
| 5 | **Test** | `test` | Vitest · `tests/**/*.test.ts` (Issue 종료 조건 테스트 포함 — [2-1절](#2-1-issue-종료-조건-테스트)) · 설정 [`vitest.config.ts`](../../vitest.config.ts) | [06](../06-architecture.md) §9 불변식 · 각 Issue의 종료 조건 |
| 6 | **Build** | `build` | `prisma generate` + `next build` | — |

각 단계의 상세 규칙(무엇을 허용하고 무엇을 막는지)은 위 파일의 머리 주석과 코드에 있다. 여기에 옮겨 적지 않는다.

## 2-1. Issue 종료 조건 테스트

Issue의 **3. 종료 조건**은 사람이 읽는 문장이고, 그것을 기계가 판정하는 곳이 이 테스트다.

| 항목 | 규칙 |
|---|---|
| 위치 · 이름 | `tests/issues/issue-{Issue 번호}-{기능명}.test.ts` — 기능명은 영문 소문자 kebab-case (예: `issue-12-qty-input-decimal.test.ts`) |
| 대응 | **종료 조건 한 줄 = `it()` 하나.** `it()` 이름은 종료 조건 문장을 그대로 쓴다 |
| 묶음 | `describe('#{번호} {Issue 제목}')` 하나로 감싼다 |
| 데이터 | 검증 DB를 쓴다. 다른 테스트처럼 **자기가 만든 데이터만** 앞뒤로 정리한다 (`tests/helpers.ts` 사용) |
| 실행 | `npm run verify`의 Test 단계에 자동 포함 · Issue 테스트만: `npm run test:issues` · 한 Issue만: `npx vitest run issue-{번호}-` |
| 수명 | Issue가 닫혀도 지우지 않는다. 같은 동작이 다시 깨지는 것을 막는 회귀 테스트로 남는다 |

Issue의 **4. 기계 검증** 칸에 이 파일 경로를 적고, 완료 보고 때 종료 조건과 `it()` 결과를 한 줄씩 대응시켜 보고한다.
종료 조건에 "저장하면 …"처럼 **서버 동작**이 들어 있으면 안쪽 함수가 아니라 서버 액션(`src/actions/*`)을 직접 불러 판정한다 (2-2절).

## 2-2. 테스트 작성 규칙

모든 테스트(`tests/**`)에 적용한다. 헬퍼는 [`tests/support/`](../../tests/support/)에 있고, 사용법은 각 파일 머리 주석에 있다.

| 항목 | 규칙 | 헬퍼 |
|---|---|---|
| 날짜 | **실제 날짜에 기대지 않는다.** 유통기한 같은 날짜는 `today()` 기준 상대값(`addDays(today(), 30)`)으로 만들거나, 기준일을 고정한다. `'2026-09-10'` 같은 절대 날짜를 쓸 때는 반드시 기준일도 고정한다 | `fixToday()` · `restoreToday()` ([`time.ts`](../../tests/support/time.ts)) · 배분 함수의 `asOf` 옵션 |
| 서버 액션 | 로그인 · 캐시 무효화만 대역으로 바꾸고 나머지(DB · 배분 · `applyMovement`)는 실제 코드를 태운다 | `authMock()` · `nextCacheMock()` · `setActionUser()` ([`actions.ts`](../../tests/support/actions.ts)) |
| 데이터 | 테스트 전용 상품(`sku: 'TEST-…'`)을 만들어 시드 데이터와 섞지 않는다. 앞뒤로 자기가 만든 것만 지운다 | `tests/helpers.ts` |
| 기존 테스트 변경 | 기대값을 바꾸거나 지우려면 근거가 있어야 한다 — [SSOT §8](SSOT.md#조건이-붙은-영역) | — |

헬퍼 자체는 [`tests/support.test.ts`](../../tests/support.test.ts)가 검사한다.

---

## 3. 검증 환경

### 데이터베이스
- 검증은 **검증 전용 DB**(`scripts/verify-db.ts` 가 정한 경로)에서 한다. 개발 DB는 읽지도 쓰지도 않는다.
- Prepare가 매번 새로 만들므로 **이전 실행이나 로컬 개발 데이터가 결과에 영향을 주지 않는다.**
- 테스트(`npm test`)는 단독 실행해도 검증 DB를 쓴다. 검증 DB가 없으면 먼저 `npm run verify:prepare` 를 실행한다.
- DB를 쓰는 단계는 Prepare와 Test뿐이다.

### 시드
- 시드는 실행한 날을 기준으로 상대 날짜(예: 95일 전 입고)를 만든다. **같은 날에는 같은 데이터**, 날짜가 바뀌면 절대 날짜만 하루씩 밀린다.

### 로컬 ↔ CI
| | 로컬 | CI (GitHub Actions) |
|---|---|---|
| 실행 시점 | 직접 실행 | 모든 PR · `main` push |
| 설치 | `npm install` | `npm ci` |
| Node · npm | 개발자 환경 | 워크플로에 고정된 버전 |
| `.env` | 있음 | 없음 — 워크플로가 `DATABASE_URL` 을 검증 DB로 지정 |

CI의 Node 버전은 로컬과 맞춰 고정되어 있다. 로컬 Node·npm을 올리면 워크플로도 함께 올려야 한다 (npm 버전에 따라 `package-lock.json` 검사 방식이 달라 `npm ci` 가 실패할 수 있다).

---

## 4. 실패했을 때

1. 출력의 **마지막 단계 이름**과 오류 위치(`파일:줄`)를 확인한다.
2. 원인이 **변경한 코드**에 있으면 코드를 고친다. 검증 단계를 건너뛰거나 규칙을 끄지 않는다.
3. 원인이 **검증 스크립트 · 설정 자체**에 있다고 보이면 고치지 않고 사람에게 알린다 ([SSOT §8](SSOT.md#8-보호-경계) — 검증 스크립트는 AI가 "실행"만 한다).
4. 검사 규칙과 원본 문서(01 · 06)가 다르다고 보이면 [SSOT §7 충돌 정책](SSOT.md#7-충돌-정책)을 따른다.

---

## 5. 아직 검증하지 않는 것

`npm run verify` 를 통과해도 아래는 확인되지 않는다.

| 항목 | 현재 상태 |
|---|---|
| 데이터 불변식 (Lot = Movement 합계, 수량 양수, 중복 상쇄 없음 등) | 테스트 일부로만 확인. 검증 DB 전체를 대상으로 하는 검사 단계는 없다 |
| 화면 동작 (E2E) | 자동화 없음. 저장소에 Playwright 테스트가 없다 — 화면을 바꾼 작업은 [`Workflow.md`](Workflow.md) §4 절차로 확인하고 결과를 Issue 작업 기록에 남긴다 |
| [01](../01-requirements.md) §7 완료 기준 중 화면 · 이력 · 실사 관련 항목 | 수동 확인 또는 미구현 |
| `scripts/verify-m1.ts` · `scripts/verify-headline.ts` | 파이프라인에 포함되지 않음. 실패해도 종료 코드가 0이다 |
| 정적 검사로 못 잡는 우회 (`const l = db.lot; l.update()` 등) | Architecture 단계 범위 밖 |
| 날짜에 따른 결과 차이 | 시드는 실행한 날 기준이라, 날짜가 바뀌면 시드 과정의 배분(만료 판정 등)이 달라질 수 있다. 테스트는 2-2절 규칙으로 막지만 시드는 막지 않는다 — 시드를 고칠 때 [SSOT §8](SSOT.md#조건이-붙은-영역) 조건을 따른다 |

---

## 6. 변경

- 단계 추가 · 삭제 · 순서 변경, 검사 규칙 변경은 **사람의 승인**이 필요하다 ([SSOT §8](SSOT.md#8-보호-경계)).
- 스크립트를 바꾸면 이 문서의 [1절](#1-원본-위치) · [2절](#2-단계) 표도 같은 작업에서 맞춘다.
