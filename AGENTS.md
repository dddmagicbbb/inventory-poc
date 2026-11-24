# AGENTS.md — 문서 라우팅

이 파일은 **어떤 질문에 어떤 문서를 읽을지**만 정한다. 규칙의 내용은 원본 문서에 있다.
원본 지정의 근거는 [`docs/harness/SSOT.md`](docs/harness/SSOT.md)다.

---

## 1. 작업 시작 규칙

1. **모든 문서를 한꺼번에 읽지 않는다.** 이 파일만 읽고 시작한다.
2. 질문을 아래 [2절 라우팅 표](#2-라우팅-표)에서 분류하고, **표가 가리키는 원본의 해당 절만** 읽는다.
3. 질문이 여러 종류에 걸치면 종류별로 나눠 각각의 원본 절을 읽는다.
4. 라우팅된 문서로 **판단할 수 없을 때만** [3절 순서](#3-탐색-범위-넓히기)대로 한 단계씩 넓힌다. 넓힐 때는 왜 넓히는지 사용자에게 한 줄로 알린다.
5. **원본이 아닌 문서는 읽지 않는다** ([4절](#4-읽지-않는-문서)). 필요한 내용이 그런 문서에만 있으면 읽지 말고, 원본으로 옮길지 사용자에게 묻는다.

## 1-1. 작업 마무리 규칙 — 검증

상세는 [`docs/harness/Verification.md`](docs/harness/Verification.md)에 있다.

1. 코드 · 스키마 · 테스트 · 설정을 바꿨으면 **완료를 보고하거나 커밋하기 전에 `npm run verify`를 실행한다.**
2. **종료 코드 0일 때만 완료로 보고한다.** 실패하면 실패한 단계와 오류 위치를 그대로 보고한다.
3. 실패 원인이 변경한 코드에 있으면 고친 뒤 다시 실행한다. **단계를 건너뛰거나 검사 규칙을 끄지 않는다.**
4. 원인이 검증 스크립트 · 설정 자체에 있다고 보이면 고치지 않고 사람에게 알린다 (검증 스크립트는 AI가 실행만 한다).
5. 문서만 바꾼 작업은 실행하지 않아도 된다. 실행하지 않았으면 그렇다고 보고한다.

---

## 2. 라우팅 표

### 재고 도메인 — 원본 [`docs/01-requirements.md`](docs/01-requirements.md)
| 질문 | 읽을 절 |
|---|---|
| 이 앱이 무엇을 푸는가, 범위 | §1 프로젝트 정의 |
| 로트 · 거점 개념, 재고를 세는 단위 | §2 핵심 개념 |
| 입고 · 출고 · 발송 · 팝업 · 조정 · 만료 · 이력 · 로그인 기능 요구 | §3 해당 F 항목 (F1~F11) |
| 재고 증감 사유 코드 | §3 F5-1 |
| 개념 수준 데이터 모델 | §4 |
| 무결성 · 모바일 · 성능 · 접근성 · 백업 등 품질 요구 | §5 비기능 요구사항 |
| 이 기능을 넣어야 하는가 | §6 범위 제외 |
| 무엇이 되면 완료인가 | §7 완료 기준 |
| 이미 확정된 가정 | §8 |

### 아키텍처 · 구현 방식 — 원본 [`docs/06-architecture.md`](docs/06-architecture.md)
| 질문 | 읽을 절 |
|---|---|
| 실행 방식, 스택, 설치 버전 | §0 · §1 |
| 파일을 어디에 두는가 | §2 폴더 구조 |
| 테이블 · 필드 · 관계 | §3 데이터 모델 |
| 재고 수량을 바꾸는 방법 | §4.1 `applyMovement()` |
| 로트 배분 (FEFO · LEFO) | §4.2 |
| 팝업 정산 역산 | §4.3 |
| 취소 · 되돌리기 | §4.4 상쇄 기록 |
| 상태 전이, 쓰기 데이터 흐름 | §5 |
| 인증 · 세션 | §6 |
| 시드 데이터 | §7 |
| 계층 구조 요약 | §7.5 |
| 동시성 · 성능 | §8 |
| 자동 테스트로 지킬 불변식 | §9 |

### 개별 작업 — 원본: 해당 GitHub Issue
| 질문 | 읽을 것 |
|---|---|
| 버그 수정 · 기능 추가 · 이슈 처리 | `gh issue view <번호> --repo dddmagicbbb/inventory-poc` |
| 작업 중 도메인 · 아키텍처 판단이 필요 | Issue를 먼저 읽고, 판단 부분만 위 두 표로 다시 라우팅 |

> ⚠ 2026-11-24 현재 저장소의 Issues 기능이 꺼져 있다. 작업의 근거 Issue가 없으면 추측해서 시작하지 말고 사용자에게 작업 범위를 확인한다.

### 검증 — 원본: 검증 스크립트 · 안내 [`docs/harness/Verification.md`](docs/harness/Verification.md)
| 질문 | 읽을 것 |
|---|---|
| 무엇을 통과해야 완료인가 | `npm run verify` 실행 (종료 코드 0 = 통과) · 안내 §0 |
| 검증 단계 · 각 단계의 명령과 파일 | `package.json` `scripts` · 안내 §1 · §2 |
| Issue 종료 조건 테스트를 어디에 어떻게 만드는가 | 안내 §2-1 (`tests/issues/issue-{번호}-{기능명}.test.ts`) |
| 검증 DB · CI 환경 | 안내 §3 |
| 검증이 실패했을 때 | 안내 §4 |
| 무엇이 아직 검증되지 않는가 | 안내 §5 |

### 원본이 아직 없는 영역
| 질문 | 처리 |
|---|---|
| 구현 · 검증 루프 (작업 진행 절차) | **미작성** — 사용자에게 확인 |
| 운영 · 디자인 · Git 협업 규칙 | 원본 미지정 — 사용자에게 확인 |
| 어떤 문서가 원본인가 | [`docs/harness/SSOT.md`](docs/harness/SSOT.md) |
| Next.js API · 파일 규칙 | 아래 Next.js 블록 (`node_modules/next/dist/docs/`) |

---

## 3. 탐색 범위 넓히기

라우팅된 절로 판단할 수 없을 때만, 아래 순서로 **한 단계씩** 넓힌다. 답이 나오면 멈춘다.

1. 같은 원본의 **인접 절** (예: §3 F5로 부족하면 F5-1, §2)
2. **다른 원본**의 관련 절 (도메인 ↔ 아키텍처)
3. **코드 · 스키마 · 테스트** — 필요한 파일만 검색해서 읽는다 (`src/`, `prisma/schema.prisma`, `tests/`)
4. 그래도 판단할 수 없으면 **사용자에게 묻는다.** 원본에 빈칸이 있다는 뜻이므로 어느 원본에 채울지도 함께 제안한다

---

## 4. 읽지 않는 문서

원본이 아니므로 판단 근거로 쓰지 않는다:
`docs/02-personas.md` · `docs/03-scenarios.md` · `docs/04-engagement.md` · `docs/05-design.md` · `docs/07-plan.md` · `docs/HANDOVER.md` · `docs/ISSUES.md` · `README.md` · `mockups/`

원본 지정이 바뀌면 `docs/harness/SSOT.md`를 따르고 이 목록도 함께 고친다.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
