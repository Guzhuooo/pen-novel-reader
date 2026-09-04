import { test } from 'node:test'
import assert from 'node:assert'
import { paginate, pageOfOffset, pageCount, previewOf } from '../ui/src/utils/paginator.js'
import { normalizeRawText, charUnits } from '../ui/src/utils/text.js'
import { landscapeLayout } from '../ui/src/utils/coords.js'

test('normalizeRawText strips BOM/CRLF and detects lossy chars', () => {
  const a = normalizeRawText('\uFEFF第一行\r\n第二行\r\n')
  assert.equal(a.text, '第一行\n第二行')
  assert.equal(a.lossy, false)
  const b = normalizeRawText('abc\ufffddef')
  assert.equal(b.lossy, true)
})

test('charUnits: CJK full width, ASCII narrow', () => {
  assert.equal(charUnits('中'), 1)
  assert.equal(charUnits('a'), 0.55)
  assert.equal(charUnits('\n'), 0)
})

test('paginate covers the whole text with contiguous pages', () => {
  const text = '一二三四五六七八九十'.repeat(30) // 300 字，无换行
  const offsets = paginate(text, 10, 5)
  assert.ok(offsets.length >= 2)
  assert.equal(offsets[0], 0)
  assert.equal(offsets[offsets.length - 1], text.length)
  for (let i = 1; i < offsets.length; i++) {
    assert.ok(offsets[i] > offsets[i - 1], 'pages must advance')
  }
  // 每页字数不超过 每页行数×每行字数
  const perPage = Math.ceil(10 * 0.96) * 5
  for (let i = 0; i < offsets.length - 1; i++) {
    assert.ok(offsets[i + 1] - offsets[i] <= perPage + 2, 'page size bounded')
  }
})

test('paginate respects newlines', () => {
  const text = Array.from({ length: 20 }, (_, i) => '第' + i + '行内容').join('\n')
  const offsets = paginate(text, 20, 3)
  assert.equal(offsets[0], 0)
  assert.equal(offsets[offsets.length - 1], text.length)
})

test('pageOfOffset is the inverse of paginate boundaries', () => {
  const text = '甲乙丙丁戊己庚辛壬癸'.repeat(40)
  const offsets = paginate(text, 10, 4)
  const total = pageCount(offsets)
  assert.ok(total > 3)
  for (let p = 0; p < total; p++) {
    assert.equal(pageOfOffset(offsets, offsets[p]), p)
  }
  assert.equal(pageOfOffset(offsets, text.length - 1), total - 1)
  assert.equal(pageOfOffset(offsets, 0), 0)
})

test('previewOf skips newlines', () => {
  assert.equal(previewOf('abc\n\ndef', 0, 10), 'abcdef')
})

test('landscapeLayout gives sane bounds', () => {
  const l = landscapeLayout(22)
  assert.equal(l.charsPerLine, Math.floor(760 / 22))
  assert.ok(l.linesPerPage >= 4 && l.linesPerPage <= 7)
  const s = landscapeLayout(26)
  assert.ok(s.charsPerLine < l.charsPerLine)
})
