import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', async () => (await import('./support/actions')).authMock())
vi.mock('next/cache', async () => (await import('./support/actions')).nextCacheMock())

import { db, ids } from './helpers'
import { setActionUser } from './support/actions'
import { fixToday, restoreToday } from './support/time'
import { saveOutbound } from '@/actions/outbound'
import { applyMovement } from '@/lib/stock'
import { addDays, dateOnly, formatDate, today } from '@/lib/date'

/** 테스트 헬퍼(tests/support) 자체가 동작하는지 확인한다 */
const SKU = 'TEST-SUPPORT-HELPERS'

async function cleanup() {
  const product = await db.product.findUnique({ where: { sku: SKU } })
  if (!product) return
  await db.movement.deleteMany({ where: { productId: product.id } })
  await db.lot.deleteMany({ where: { productId: product.id } })
  await db.product.delete({ where: { id: product.id } })
}

describe('테스트 헬퍼', () => {
  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('fixToday는 today()를 고정하고 restoreToday는 되돌린다', () => {
    fixToday('2026-08-01')
    expect(formatDate(today())).toBe('2026-08-01')
    restoreToday()
    expect(formatDate(today())).not.toBe('2026-08-01')
  })

  it('setActionUser(null)이면 서버 액션이 세션 만료로 거절한다', async () => {
    setActionUser(null)
    const res = await saveOutbound({ productId: 1, locationId: 1, reason: 'SALE', quantity: 1 })
    expect(res).toEqual({ ok: false, error: '로그인 정보가 만료되었습니다. 다시 로그인해주세요' })
  })

  it('setActionUser(user)이면 서버 액션이 실제 DB에 저장한다', async () => {
    const { own, user } = await ids()
    const product = await db.product.create({ data: { sku: SKU, name: '헬퍼 테스트 상품' } })
    const expiryDate = dateOnly(addDays(today(), 100))
    await db.$transaction((tx) =>
      applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        productId: product.id,
        expiryDate,
        quantity: 5,
        toLocationId: own.id,
        userId: user.id,
      })
    )

    setActionUser({ id: user.id })
    const res = await saveOutbound({
      productId: product.id,
      locationId: own.id,
      reason: 'SALE',
      quantity: 2,
    })
    expect(res.ok).toBe(true)
    const lot = await db.lot.findFirstOrThrow({ where: { productId: product.id, locationId: own.id } })
    expect(lot.quantity).toBe(3)
  })
})
