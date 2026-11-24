import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { VERIFY_DATABASE_URL } from './scripts/verify-db'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    // 테스트는 개발 DB가 아니라 검증 DB를 쓴다 (먼저 `npm run verify:prepare`로 만든다)
    env: { DATABASE_URL: VERIFY_DATABASE_URL },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
