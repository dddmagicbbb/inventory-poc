/**
 * 검증 전용 DB 위치 — Prepare 스크립트와 테스트 설정(vitest.config.ts)이 같은 값을 쓴다.
 * 개발 DB(prisma/dev.db)와 분리되어 있어 로컬 개발 데이터가 검증 결과에 영향을 주지 않는다.
 */
export const VERIFY_DB_FILE = 'prisma/verify.db'
export const VERIFY_DATABASE_URL = `file:./${VERIFY_DB_FILE}`
