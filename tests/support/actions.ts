import { vi } from 'vitest'
import type { SessionUser } from '@/lib/session'

/**
 * 서버 액션(`src/actions/*`)을 테스트에서 직접 부르기 위한 대역.
 *
 * 서버 액션은 로그인 쿠키(`next/headers`)와 `revalidatePath`(`next/cache`)를 쓰므로
 * Next.js 밖에서는 그대로 부를 수 없다. 이 두 모듈만 바꿔 끼우고 나머지(DB · 배분 · applyMovement)는 실제 코드를 탄다.
 *
 * 사용법 — 테스트 파일 맨 위에 그대로 붙인다 (vi.mock은 파일 맨 위로 끌어올려지므로 헬퍼 안에서 부를 수 없다):
 *
 *   vi.mock('@/lib/auth', async () => (await import('../support/actions')).authMock())
 *   vi.mock('next/cache', async () => (await import('../support/actions')).nextCacheMock())
 *   import { setActionUser } from '../support/actions'
 *
 *   setActionUser(user)  // 로그인한 사용자로 실행
 *   setActionUser(null)  // 세션 만료 상태로 실행
 *
 * 경로는 테스트 파일 위치 기준이다 (`tests/` 바로 아래면 `./support/actions`).
 */

let current: SessionUser | null = null

export function setActionUser(user: Pick<SessionUser, 'id'> & Partial<SessionUser> | null) {
  current = user
    ? { id: user.id, name: user.name ?? '테스트', email: user.email ?? 'test@example.com', role: user.role ?? 'WAREHOUSE' }
    : null
}

/** `@/lib/auth` 대역 — 실제 모듈과 같은 이름 · 같은 오류 문구를 내보낸다 */
export function authMock() {
  class SessionExpiredError extends Error {
    constructor() {
      super('로그인 정보가 만료되었습니다. 다시 로그인해주세요')
      this.name = 'SessionExpiredError'
    }
  }
  return {
    SessionExpiredError,
    requireUser: async (): Promise<SessionUser> => {
      if (!current) throw new SessionExpiredError()
      return current
    },
  }
}

/** `next/cache` 대역 — 화면 캐시 무효화는 테스트에서 할 일이 없다 */
export function nextCacheMock() {
  return { revalidatePath: vi.fn(), revalidateTag: vi.fn() }
}
