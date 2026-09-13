// 纯逻辑：章节解析。
// 识别常见中文小说章节行（行首、且该行较短）：
//   第一回　宴桃园豪杰三结义 / 第123章 xxx / 【第5节】xxx / Chapter 12
//   序章 / 楔子 / 前言 / 尾声 / 番外
// 返回 [{title, offset}]，offset 为该行在全文中的起始字符下标。

const NUM = '[0-9零一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟]{1,12}'
const RE_CHAPTER = new RegExp('^\\s*第\\s*' + NUM + '\\s*[章回节卷篇集]')
const RE_BRACKET = new RegExp('^\\s*[【\\[（(]\\s*第?\\s*' + NUM + '\\s*[章回节卷篇集]')
const RE_EN = /^\s*(?:chapter|Chapter|CHAPTER)\s*[0-9]{1,4}\b/
// 特殊章节名：后面必须是行尾或分隔符，避免「引子内容」这类正文被误判；
// 允许「番外2」「序章 一」这类带编号写法。
const RE_VOLUME = new RegExp('^\\s*卷\\s*' + NUM + '\\s*[:：、.．\\-—\\s]')
const RE_SPECIAL = new RegExp(
  '^\\s*(?:序章|序言|楔子|前言|引子|尾声|后记|终章|番外[0-9零一二三四五六七八九十]{0,3})' +
  '(?:\\s|$|[:：、.．\\-—])'
)
const MAX_HEAD_LEN = 40
// 行首字符预筛，避免对每一行跑正则
const PREFILTER = {}
for (const ch of ['第', '【', '[', '（', '(', '序', '楔', '前', '引', '尾', '后', '终', '番', '卷', 'c', 'C']) {
  PREFILTER[ch] = true
}

export function isChapterLine(line) {
  const t = line.replace(/\s+$/, '')
  const bare = t.replace(/^\s+/, '')
  if (!bare || bare.length > MAX_HEAD_LEN) return false
  if (!PREFILTER[bare.charAt(0)]) return false
  if (RE_EN.test(bare)) return true
  if (RE_SPECIAL.test(bare)) return true
  if (RE_CHAPTER.test(bare)) return true
  if (RE_BRACKET.test(bare)) return true
  if (RE_VOLUME.test(bare)) return true
  return false
}

function cleanTitle(line) {
  return line.replace(/^\s+/, '').replace(/\s+$/, '').slice(0, 30)
}

// 一次性解析（小文本或单测用）
export function findChapters(text) {
  const s = new ChapterScanner(text || '')
  s.step(Infinity)
  return s.chapters
}

// 增量章节扫描器：大书按预算分片推进，让出主线程。
export class ChapterScanner {
  constructor(text) {
    this.text = text || ''
    this.chapters = []
    this.i = 0
    this.done = this.text.length === 0
  }

  step(budgetChars) {
    const t = this.text
    const n = t.length
    let processed = 0
    while (this.i < n && processed < budgetChars) {
      // 处理一整行
      let end = t.indexOf('\n', this.i)
      if (end === -1) end = n
      const lineLen = end - this.i
      if (lineLen > 0 && lineLen <= MAX_HEAD_LEN + 8) {
        const line = t.slice(this.i, end)
        if (isChapterLine(line)) {
          this.chapters.push({ title: cleanTitle(line), offset: this.i })
        }
      }
      processed += lineLen + 1
      this.i = end + 1
    }
    if (this.i >= n) {
      this.done = true
      // 过滤明显的重复/误报：整本至少 2 章才算章节体
      if (this.chapters.length < 2) this.chapters = []
    }
    return this.done
  }

  progress() {
    return this.done ? 100 : Math.min(99, Math.round(this.i * 100 / this.text.length))
  }
}

// 二分：返回 offset 所在章节下标（-1 表示在第一章之前）
export function chapterIndexOf(chapters, offset) {
  if (!chapters || chapters.length === 0) return -1
  let lo = 0
  let hi = chapters.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (chapters[mid].offset <= offset) { ans = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  return ans
}
