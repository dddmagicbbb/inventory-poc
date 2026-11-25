import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, ids } from '../helpers'
import { applyMovement, InsufficientStockError } from '@/lib/stock'
import { addDays, dateOnly, today } from '@/lib/date'
import {
  ALLOCATION,
  allocateFefo,
  allocateLots,
  allowsUnsellable,
  planAllocation,
  planFefo,
  type FefoLot,
} from '@/lib/fefo'
import { REASON_CODES } from '@/lib/constants'

/**
 * #2 출고 · 팝업 반출 · 일일 반영에서 만료 로트가 1순위로 배분된다
 *
 * 판매 · 반출 배분은 expiryDate >= today() + 7일 로트만 후보로 쓴다.
 * 이 테스트 전용 상품을 만들어 시드 데이터와 섞이지 않게 한다.
 */
const SKU = 'TEST-ISSUE-2-FEFO'

const D = {
  expired: dateOnly(addDays(today(), -3)), // 이미 만료
  in6: dateOnly(addDays(today(), 6)), // 7일 미만 잔여
  in7: dateOnly(addDays(today(), 7)), // 경계 — 판매 가능
  in30: dateOnly(addDays(today(), 30)),
}

let productId = 0
let ownId = 0
let userId = 0

async function cleanup() {
  const product = await db.product.findUnique({ where: { sku: SKU } })
  if (!product) return
  await db.movement.deleteMany({ where: { productId: product.id } })
  await db.lot.deleteMany({ where: { productId: product.id } })
  await db.product.delete({ where: { id: product.id } })
}

async function inbound(expiryDate: Date, quantity: number) {
  await db.$transaction((tx) =>
    applyMovement(tx, {
      type: 'INBOUND',
      reason: 'PURCHASE',
      productId,
      expiryDate,
      quantity,
      toLocationId: ownId,
      userId,
    })
  )
}

async function setLots(entries: [Date, number][]) {
  await db.movement.deleteMany({ where: { productId } })
  await db.lot.deleteMany({ where: { productId } })
  for (const [d, q] of entries) await inbound(d, q)
}

async function previewLots(): Promise<FefoLot[]> {
  const lots = await db.lot.findMany({ where: { productId, locationId: ownId } })
  return lots.map((l) => ({ id: l.id, expiryDate: l.expiryDate, quantity: l.quantity }))
}

const usedDates = (plan: { expiryDate: Date }[]) => plan.map((a) => dateOnly(a.expiryDate).getTime())

describe('#2 출고 · 팝업 반출 · 일일 반영에서 만료 로트가 1순위로 배분된다', () => {
  beforeAll(async () => {
    await cleanup()
    const { own, user } = await ids()
    ownId = own.id
    userId = user.id
    const product = await db.product.create({ data: { sku: SKU, name: '이슈2 테스트 상품' } })
    productId = product.id
  })
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('사유 판매 출고 미리보기와 저장에서 만료일 -7일 기준 미달 로트(만료 포함)가 선택되지 않는다', async () => {
    await setLots([
      [D.expired, 10],
      [D.in6, 5],
      [D.in30, 20],
    ])
    const includeUnsellable = allowsUnsellable(REASON_CODES.SALE)
    expect(includeUnsellable).toBe(false)

    // 미리보기 (OutboundForm)
    const preview = planFefo(await previewLots(), 10, { includeUnsellable })
    expect(preview.shortage).toBe(0)
    expect(usedDates(preview.plan)).toEqual([D.in30.getTime()])

    // 저장 (saveOutbound → allocateFefo)
    const saved = await db.$transaction((tx) =>
      allocateFefo(tx, { productId, locationId: ownId, quantity: 10, includeUnsellable })
    )
    expect(usedDates(saved)).toEqual([D.in30.getTime()])

    // 파손 · 폐기 사유는 기준 미달 로트를 FEFO 순서로 쓸 수 있다
    expect(allowsUnsellable(REASON_CODES.DAMAGE)).toBe(true)
    expect(allowsUnsellable(REASON_CODES.DISPOSE)).toBe(true)
    const damage = await db.$transaction((tx) =>
      allocateFefo(tx, { productId, locationId: ownId, quantity: 10, includeUnsellable: true })
    )
    expect(usedDates(damage)).toEqual([D.expired.getTime()])
  })

  it('팝업 반출 배분에서 만료일 -7일 기준 미달 로트(만료 포함)가 선택되지 않는다', async () => {
    await setLots([
      [D.expired, 14],
      [D.in6, 3],
      [D.in30, 20],
    ])

    // 미리보기 (PopupShipOut)
    const preview = planAllocation(await previewLots(), 14, ALLOCATION.FEFO)
    expect(usedDates(preview.plan)).toEqual([D.in30.getTime()])

    // 저장 (shipOutPopup → allocateLots)
    const saved = await db.$transaction((tx) =>
      allocateLots(tx, { productId, locationId: ownId, quantity: 14, strategy: ALLOCATION.FEFO })
    )
    expect(usedDates(saved)).toEqual([D.in30.getTime()])
  })

  it('만료일이 today() + 7일 이상 남은 로트는 정상적으로 배분 후보에 포함된다', async () => {
    await setLots([
      [D.in6, 5],
      [D.in7, 4],
      [D.in30, 20],
    ])

    const preview = planFefo(await previewLots(), 10)
    expect(preview.plan.map((a) => [dateOnly(a.expiryDate).getTime(), a.qty])).toEqual([
      [D.in7.getTime(), 4], // 경계(정확히 7일)는 포함 · FEFO 순서 유지
      [D.in30.getTime(), 6],
    ])

    const saved = await db.$transaction((tx) =>
      allocateLots(tx, { productId, locationId: ownId, quantity: 10, strategy: ALLOCATION.FEFO })
    )
    expect(saved.map((a) => [dateOnly(a.expiryDate).getTime(), a.qty])).toEqual([
      [D.in7.getTime(), 4],
      [D.in30.getTime(), 6],
    ])
  })

  it('만료일 -7일 기준 미달 로트만 남은 경우 재고 부족으로 안내된다', async () => {
    await setLots([
      [D.expired, 10],
      [D.in6, 5],
    ])

    const preview = planFefo(await previewLots(), 3)
    expect(preview.plan).toEqual([])
    expect(preview.shortage).toBe(3)
    expect(preview.available).toBe(0)
    expect(preview.excluded).toBe(15)

    const err = await db
      .$transaction((tx) =>
        allocateLots(tx, { productId, locationId: ownId, quantity: 3, strategy: ALLOCATION.FEFO })
      )
      .catch((e) => e)
    expect(err).toBeInstanceOf(InsufficientStockError)
    expect(err.detail).toMatchObject({ want: 3, have: 0 })
  })
})
