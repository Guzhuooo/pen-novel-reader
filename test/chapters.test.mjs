import { test } from 'node:test'
import assert from 'node:assert'
import { isChapterLine, findChapters, ChapterScanner, chapterIndexOf } from '../ui/src/utils/chapters.js'

test('recognizes common Chinese chapter headings', () => {
  assert.ok(isChapterLine('第一回　宴桃园豪杰三结义'))
  assert.ok(isChapterLine('第123章 觉醒'))
  assert.ok(isChapterLine('  第十二节'))
  assert.ok(isChapterLine('【第五章】初入宗门'))
  assert.ok(isChapterLine('楔子'))
  assert.ok(isChapterLine('Chapter 12 The Beginning'))
})

test('rejects body text and over-long lines', () => {
  assert.ok(!isChapterLine('话说天下大势，分久必合。'))
  assert.ok(!isChapterLine('他说第一章讲的是啥？'))
  assert.ok(!isChapterLine('第' + '一'.repeat(40) + '章' + '很长'.repeat(20)))
  assert.ok(!isChapterLine(''))
})

test('findChapters returns offsets pointing at line starts', () => {
  const text = '楔子\n引子内容\n第一回　开篇\n内容一\n第二回　深入\n内容二\n第三回　结束'
  const ch = findChapters(text)
  assert.deepEqual(ch.map(c => c.title), ['楔子', '第一回　开篇', '第二回　深入', '第三回　结束'])
  for (const c of ch) {
    assert.equal(text.slice(c.offset, c.offset + c.title.length), c.title)
  }
})

test('single or zero chapter matches are dropped (not a chapter book)', () => {
  assert.deepEqual(findChapters('只有第一章\n然后全是正文'), [])
})

test('incremental scanner matches one-shot result', () => {
  const text = ('正文段落。\n'.repeat(50) + '第一章　起\n' + '内容\n'.repeat(50) + '第二章　承\n' + '内容\n'.repeat(30)).repeat(20)
  const oneShot = findChapters(text)
  const s = new ChapterScanner(text)
  let guard = 0
  while (!s.done && guard++ < 10000) s.step(5000)
  assert.deepEqual(s.chapters, oneShot)
  assert.ok(oneShot.length >= 2)
})

test('chapterIndexOf finds containing chapter', () => {
  const ch = [{ offset: 0, title: 'a' }, { offset: 100, title: 'b' }, { offset: 200, title: 'c' }]
  assert.equal(chapterIndexOf(ch, 0), 0)
  assert.equal(chapterIndexOf(ch, 99), 0)
  assert.equal(chapterIndexOf(ch, 100), 1)
  assert.equal(chapterIndexOf(ch, 250), 2)
  assert.equal(chapterIndexOf([], 5), -1)
})
