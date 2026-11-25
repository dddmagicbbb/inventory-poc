import { vi } from 'vitest'

/**
 * '오늘'을 고정한다 — 날짜에 따라 결과가 바뀌는 테스트를 막는다 (Verification §2-2).
 *
 * `today()` · `daysUntil()` 등은 `new Date()`를 쓰므로 Date만 가짜로 바꾼다.
 * 타이머(setTimeout 등)는 그대로 두어 DB 드라이버가 멈추지 않게 한다.
 *
 *   beforeAll(() => fixToday('2026-08-01'))
 *   afterAll(restoreToday)
 */
export function fixToday(ymd: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  // 현지 정오로 두어 시간대 차이로 날짜가 하루 밀리지 않게 한다
  vi.setSystemTime(new Date(`${ymd}T12:00:00`))
}

export function restoreToday() {
  vi.useRealTimers()
}
