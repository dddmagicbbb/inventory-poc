/**
 * Architecture Check — 재고 변경은 applyMovement()를 거친다
 *
 * 근거: docs/06-architecture.md §2 "규칙 하나", §4.1
 *   재고 수량을 바꾸는 코드는 lib/stock.ts의 applyMovement() 한 곳에만 존재한다.
 *   화면·액션은 이 함수를 부를 뿐, lot.update()를 직접 호출하지 않는다.
 *
 * 검사 내용 (TypeScript 구문 분석 — 주석은 무시, 여러 줄에 걸친 호출도 잡는다)
 *   1. `<클라이언트>.lot.<쓰기>()` · `<클라이언트>.movement.<쓰기>()` 호출
 *   2. Lot · Movement 테이블을 바꾸는 raw SQL ($executeRaw 등)
 *
 * 허용
 *   - src/lib/stock.ts            : 유일한 통로
 *   - prisma/seed.ts · tests/**   : 데이터 초기화 · 테스트 정리용 deleteMany 만
 *
 * 위반이 있으면 위치를 출력하고 종료 코드 1로 끝난다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SCAN_DIRS = ['src', 'scripts', 'prisma', 'tests']
const SKIP_DIRS = ['src/generated', 'node_modules']

const GUARDED_MODELS = new Set(['lot', 'movement'])
const WRITE_METHODS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])
const RAW_METHODS = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe'])
const RAW_WRITE_SQL = /\b(INSERT\s+(OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+["`[]?(Lot|Movement)\b/i

const STOCK_GATEWAY = 'src/lib/stock.ts'
const CLEANUP_ONLY = (file: string) => file === 'prisma/seed.ts' || file.startsWith('tests/')

type Violation = { file: string; line: number; code: string; reason: string }

function listFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  let entries: string[]
  try {
    entries = readdirSync(abs)
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    const rel = `${dir}/${name}`
    if (SKIP_DIRS.includes(rel)) return []
    if (statSync(path.join(ROOT, rel)).isDirectory()) return listFiles(rel)
    return /\.(ts|tsx|mts|cts)$/.test(name) && !name.endsWith('.d.ts') ? [rel] : []
  })
}

function check(file: string): Violation[] {
  const text = readFileSync(path.join(ROOT, file), 'utf-8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const found: Violation[] = []
  const at = (node: ts.Node, reason: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    found.push({ file, line: line + 1, code: node.getText(sf).split('\n')[0].slice(0, 100), reason })
  }

  const visit = (node: ts.Node) => {
    // 1) x.lot.update(...) / x.movement.deleteMany(...)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      const target = node.expression.expression
      if (
        WRITE_METHODS.has(method) &&
        ts.isPropertyAccessExpression(target) &&
        GUARDED_MODELS.has(target.name.text)
      ) {
        const allowed =
          file === STOCK_GATEWAY || (CLEANUP_ONLY(file) && method === 'deleteMany')
        if (!allowed) at(node, `${target.name.text}.${method}() 직접 호출 — applyMovement()를 거쳐야 한다`)
      }
      // 2a) x.$executeRawUnsafe('UPDATE Lot ...')
      if (RAW_METHODS.has(method) && file !== STOCK_GATEWAY) {
        const sql = node.arguments.map((a) => a.getText(sf)).join(' ')
        if (RAW_WRITE_SQL.test(sql)) at(node, 'Lot · Movement 를 바꾸는 raw SQL')
      }
    }
    // 2b) x.$executeRaw`UPDATE Lot ...`
    if (
      ts.isTaggedTemplateExpression(node) &&
      ts.isPropertyAccessExpression(node.tag) &&
      RAW_METHODS.has(node.tag.name.text) &&
      file !== STOCK_GATEWAY &&
      RAW_WRITE_SQL.test(node.template.getText(sf))
    ) {
      at(node, 'Lot · Movement 를 바꾸는 raw SQL')
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

const files = SCAN_DIRS.flatMap(listFiles)
const violations = files.flatMap(check)

if (violations.length) {
  console.error(`\n❌ Architecture Check 실패 — 재고 변경은 ${STOCK_GATEWAY}의 applyMovement()만 할 수 있다\n`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.reason}\n      ${v.code}`)
  console.error(`\n  위반 ${violations.length}건 · 근거: docs/06-architecture.md §2, §4.1\n`)
  process.exit(1)
}

console.log(`✅ Architecture Check 통과 — ${files.length}개 파일, 재고 직접 변경 없음 (${STOCK_GATEWAY} 외)`)
