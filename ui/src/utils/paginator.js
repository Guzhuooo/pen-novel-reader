// 纯逻辑：分页器。
// 把整本文本按「每页 linesPerPage 行 × 每行 charsPerLine 字宽」切成若干页，
// 返回每页起始字符偏移（含结尾哨兵），页 i 的内容为 text.slice(offsets[i], offsets[i+1])。
// 用估算字宽分页，与原生换行存在误差，因此调用方传入的行/字数应略保守。

export function paginate(text, charsPerLine, linesPerPage) {
  const p = new IncrementalPaginator(text, charsPerLine, linesPerPage)
  p.step(Infinity)
  return p.offsets
}

// 增量分页器：大书不能一次排完（12MB 约需 10s），按预算分片推进，
// 每片之间让出主线程，页面可先读已排版部分。页与页之间无共享状态（每页都从行首开始）。
export class IncrementalPaginator {
  constructor(text, charsPerLine, linesPerPage) {
    this.text = text || ''
    this.half = Math.max(8, Math.floor(charsPerLine * 0.96 * 2)) // 半字宽整数累计
    this.lines = Math.max(1, linesPerPage)
    this.offsets = [0]
    this.i = 0
    this.done = this.text.length === 0
  }

  // 最多处理 budgetChars 个字符，返回是否已全部完成
  step(budgetChars) {
    const n = this.text.length
    let processed = 0
    while (this.i < n && processed < budgetChars) {
      const start = this.i
      let line = 0
      let col = 0
      while (this.i < n && line < this.lines) {
        const c = this.text.charCodeAt(this.i)
        if (c === 10) {
          this.i++
          line++
          col = 0
          continue
        }
        col += (c >= 0x2e80 || (c >= 0xff01 && c <= 0xff60) || (c >= 0x3000 && c <= 0x303f)) ? 2 : 1
        this.i++
        if (col >= this.half) {
          line++
          col = 0
        }
      }
      processed += this.i - start
      if (this.i > this.offsets[this.offsets.length - 1]) this.offsets.push(this.i)
      // 跳过下一页开头的连续换行
      while (this.i < n && this.text.charCodeAt(this.i) === 10) this.i++
    }
    if (this.i >= n) {
      if (this.offsets[this.offsets.length - 1] !== n) this.offsets.push(n)
      this.done = true
    }
    return this.done
  }

  progress() {
    return this.done ? 100 : Math.min(99, Math.round(this.i * 100 / this.text.length))
  }
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
