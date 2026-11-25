import type { Prisma } from '@/generated/prisma/client'
import { InsufficientStockError } from './stock'
import { addDays, dateOnly, today } from './date'
import { REASON_CODES, type ReasonCode } from './constants'

/**
 * 로트 배분 전략 — 상황에 따라 방향이 반대다.
 *
 * FEFO (First Expired, First Out) — 유통기한이 빠른 것부터
 *   쓰는 곳: 출고(판매·시식·파손), 풀필먼트 일일 반영, 팝업 반출, 폐기
 *   이유: 물건이 곧 소비되므로 임박한 것부터 내보내야 버리지 않는다.
 *
 * LEFO (Last Expired, First Out) — 유통기한이 늦은 것부터
 *   쓰는 곳: 자사창고 → 풀필먼트 발송
 *   이유: 풀필먼트는 도착까지 3~5일 걸리고, 도착 후 고객에게 나가기까지 더 걸린다.
 *         임박한 재고를 보내면 팔리기 전에 기한이 지난다.
 *         임박분은 자사창고에 남겨 직접 빠르게 소진한다.
 */
export const ALLOCATION = {
  FEFO: 'FEFO',
  LEFO: 'LEFO',
} as const
export type AllocationStrategy = (typeof ALLOCATION)[keyof typeof ALLOCATION]

export const ALLOCATION_LABEL: Record<AllocationStrategy, string> = {
  FEFO: '유통기한 빠른 순',
  LEFO: '유통기한 늦은 순',
}

export const ALLOCATION_REASON: Record<AllocationStrategy, string> = {
  FEFO: '임박한 재고부터 내보내 폐기를 줄입니다',
  LEFO: '풀필먼트는 도착·판매까지 오래 걸려, 기한이 넉넉한 재고를 보냅니다',
}

export type FefoLot = { id: number; expiryDate: Date; quantity: number }

/**
 * 판매 · 반출 가능 기준 — 유통기한이 오늘 + 7일 이상 남은 로트만 배분 후보다.
 * 기준에 미달하는 로트(만료 7일 미만 잔여 · 이미 만료)는 폐기 경로로만 빠진다 (06 §4.2).
 */
export const SELLABLE_MIN_DAYS = 7

/** 이 날짜(포함) 이후 만료되는 로트만 판매 · 반출 배분 후보다 */
export const sellableCutoff = (asOf: Date = today()) => addDays(dateOnly(asOf), SELLABLE_MIN_DAYS)

export const isSellableLot = (expiryDate: Date, asOf: Date = today()) =>
  dateOnly(expiryDate).getTime() >= sellableCutoff(asOf).getTime()

/** 기준 미달 로트를 써도 되는 사유 — 파손 · 폐기만 */
export const UNSELLABLE_ALLOWED_REASONS: readonly ReasonCode[] = [
  REASON_CODES.DAMAGE,
  REASON_CODES.DISPOSE,
]
export const allowsUnsellable = (reason: ReasonCode) => UNSELLABLE_ALLOWED_REASONS.includes(reason)

export type AllocationOptions = {
  /** true면 기준 미달 로트도 후보에 넣는다 (파손 · 폐기, 거점 간 발송) */
  includeUnsellable?: boolean
  /** 기준일 — 기본은 오늘 */
  asOf?: Date
}

export type Allocation = {
  lotId: number
  expiryDate: Date
  qty: number
  lotQuantity: number // 그 로트의 총 보유량 — '전부 사용 / 일부 사용' 표시용
}

/** 순수 함수 — 클라이언트 미리보기와 서버가 같은 결과를 내야 한다 */
export function planAllocation(
  lots: FefoLot[],
  quantity: number,
  strategy: AllocationStrategy = ALLOCATION.FEFO,
  options: AllocationOptions = {}
): { plan: Allocation[]; shortage: number; available: number; excluded: number } {
  const { includeUnsellable = false, asOf } = options
  const dir = strategy === ALLOCATION.LEFO ? -1 : 1
  const stocked = lots.filter((l) => l.quantity > 0)
  const candidates = includeUnsellable
    ? stocked
    : stocked.filter((l) => isSellableLot(l.expiryDate, asOf))
  const available = candidates.reduce((s, l) => s + l.quantity, 0)
  const excluded = stocked.reduce((s, l) => s + l.quantity, 0) - available
  const sorted = [...candidates]
    .sort((a, b) => dir * (a.expiryDate.getTime() - b.expiryDate.getTime()) || a.id - b.id)

  const plan: Allocation[] = []
  let remain = quantity

  for (const lot of sorted) {
    if (remain <= 0) break
    const take = Math.min(lot.quantity, remain)
    plan.push({ lotId: lot.id, expiryDate: lot.expiryDate, qty: take, lotQuantity: lot.quantity })
    remain -= take
  }
  return { plan, shortage: Math.max(0, remain), available, excluded }
}

/** 하위 호환 — 기본은 FEFO */
export const planFefo = (lots: FefoLot[], quantity: number, options?: AllocationOptions) =>
  planAllocation(lots, quantity, ALLOCATION.FEFO, options)

/** 서버 전용 — 저장 직전에 DB의 현재 재고로 다시 계산한다 */
export async function allocateLots(
  tx: Prisma.TransactionClient,
  params: {
    productId: number
    locationId: number
    quantity: number
    strategy?: AllocationStrategy
  } & AllocationOptions
): Promise<Allocation[]> {
  const { productId, locationId, quantity, strategy = ALLOCATION.FEFO, ...options } = params
  if (quantity <= 0) throw new Error('수량은 1 이상이어야 합니다')

  const lots = await tx.lot.findMany({
    where: {
      productId,
      locationId,
      quantity: { gt: 0 },
      ...(options.includeUnsellable ? {} : { expiryDate: { gte: sellableCutoff(options.asOf) } }),
    },
    orderBy: [{ expiryDate: strategy === ALLOCATION.LEFO ? 'desc' : 'asc' }, { id: 'asc' }],
  })

  const { plan, shortage, available } = planAllocation(lots, quantity, strategy, options)
  if (shortage > 0) {
    throw new InsufficientStockError({ productId, locationId, want: quantity, have: available })
  }
  return plan
}

/** 하위 호환 별칭 */
export const allocateFefo = (
  tx: Prisma.TransactionClient,
  params: { productId: number; locationId: number; quantity: number } & AllocationOptions
) => allocateLots(tx, { ...params, strategy: ALLOCATION.FEFO })
