/**
 * 검증 Prepare 단계 — 매번 깨끗하고 같은 상태의 검증 DB를 만든다.
 *
 * 1. 이전 검증 DB(prisma/verify.db)와 부속 파일을 지운다
 * 2. 마이그레이션 → Prisma 클라이언트 생성 → 시드
 *
 * 개발 DB(prisma/dev.db)는 건드리지 않는다.
 */
import { rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { VERIFY_DATABASE_URL, VERIFY_DB_FILE } from './verify-db'

// dotenv는 이미 설정된 환경 변수를 덮어쓰지 않으므로 .env의 개발 DB 설정보다 이 값이 우선한다
const env = { ...process.env, DATABASE_URL: VERIFY_DATABASE_URL }
const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', env })

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  rmSync(path.resolve(process.cwd(), VERIFY_DB_FILE + suffix), { force: true })
}

console.log(`\n▸ 검증 DB 준비: ${VERIFY_DB_FILE}\n`)
run('npx prisma migrate deploy')
run('npx prisma generate')
run('npx tsx prisma/seed.ts')
