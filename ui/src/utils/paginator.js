// 纯逻辑：分页器。
// 把整本文本按「每页 linesPerPage 行 × 每行 charsPerLine 字宽」切成若干页，
// 返回每页起始字符偏移（含结尾哨兵），页 i 的内容为 text.slice(offsets[i], offsets[i+1])。
// 用估算字宽分页，与原生换行存在误差，因此调用方传入的行/字数应略保守。
import { charUnits } from './text.js'

export function paginate(text, charsPerLine, linesPerPage) {
  const cpl = Math.max(4, Math.floor(charsPerLine * 0.96))
  const lines = Math.max(1, linesPerPage)
  const n = text.length
  const offsets = [0]
  let pageStart = 0
  let i = 0
  while (i < n) {
    let line = 0
    let col = 0
    let consumed = 0
    while (i < n && line < lines) {
      const ch = text[i]
      if (ch === '\n') {
        i++
        consumed++
        line++
        col = 0
        continue
      }
      col += charUnits(ch)
      i++
      consumed++
      if (col >= cpl) {
        line++
        col = 0
      }
    }
    if (consumed <= 0) break // 防御：保证每页至少推进 1 字符
    pageStart = i
    offsets.push(pageStart)
    // 连续换行导致的零内容页直接跳过
    while (i < n && text[i] === '\n') i++
  }
  if (offsets[offsets.length - 1] !== n) offsets.push(n)
  // 过滤掉空页（起点 == 终点）
  const clean = [offsets[0]]
  for (let k = 1; k < offsets.length; k++) {
    if (offsets[k] > clean[clean.length - 1]) clean.push(offsets[k])
  }
  return clean
}

export function pageOfOffset(offsets, offset) {
  if (!offsets || offsets.length < 2) return 0
  let lo = 0
  let hi = offsets.length - 2
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= offset) { ans = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  return ans
}

export function pageCount(offsets) {
  return offsets ? Math.max(1, offsets.length - 1) : 1
}

export function previewOf(text, offset, len = 20) {
  let s = ''
  let i = offset
  while (i < text.length && s.length < len) {
    const ch = text[i]
    if (ch !== '\n') s += ch
    i++
  }
  return s || '(空白页)'
}
