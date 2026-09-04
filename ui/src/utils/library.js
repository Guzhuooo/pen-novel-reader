// 书架/进度/书签/设置 的领域存储（基于 kvstore）
import kv from './kvstore.js'

const K_SHELF = 'nr_shelf_v1'
const K_PROGRESS = 'nr_progress_v1'
const K_MARKS = 'nr_marks_v1'
const K_SETTINGS = 'nr_settings_v1'

export function bookId(path) {
  let h = 5381
  const s = String(path)
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff
  return (h >>> 0).toString(36)
}

export function titleFromPath(path) {
  const base = String(path).split('/').pop() || path
  return base.replace(/\.(txt|text|log)$/i, '')
}

export const DEFAULT_SETTINGS = { pageMode: 'tap', theme: 0, fontSize: 22 }

export async function getShelf() {
  const list = await kv.getItem(K_SHELF, [])
  return Array.isArray(list) ? list : []
}

export async function addToShelf(path) {
  const list = await getShelf()
  const id = bookId(path)
  if (list.some(b => b.id === id)) return { id, added: false }
  list.unshift({ id, path: String(path), title: titleFromPath(path), added: Date.now() })
  await kv.setItem(K_SHELF, list)
  return { id, added: true }
}

export async function removeFromShelf(id) {
  const list = await getShelf()
  const next = list.filter(b => b.id !== id)
  await kv.setItem(K_SHELF, next)
  if (next.length !== list.length) {
    const prog = await getProgressAll()
    if (prog[id]) { delete prog[id]; await kv.setItem(K_PROGRESS, prog) }
    const marks = await getMarksAll()
    if (marks[id]) { delete marks[id]; await kv.setItem(K_MARKS, marks) }
  }
  return next
}

export async function getProgressAll() {
  const p = await kv.getItem(K_PROGRESS, {})
  return p && typeof p === 'object' ? p : {}
}

// 记录某本书的阅读位置（字符偏移 + 页码，跨版式可恢复）
export async function saveProgress(id, offset, page, pageCount) {
  const all = await getProgressAll()
  all[id] = { offset, page, pageCount, time: Date.now() }
  return kv.setItem(K_PROGRESS, all)
}

export async function getProgress(id) {
  const all = await getProgressAll()
  return all[id] || null
}

export async function getMarksAll() {
  const m = await kv.getItem(K_MARKS, {})
  return m && typeof m === 'object' ? m : {}
}

export async function getMarks(id) {
  const all = await getMarksAll()
  const list = all[id]
  return Array.isArray(list) ? list : []
}

export async function addMark(id, mark) {
  const all = await getMarksAll()
  const list = Array.isArray(all[id]) ? all[id] : []
  if (list.some(m => m.offset === mark.offset)) return list
  list.unshift({ offset: mark.offset, preview: mark.preview, time: Date.now() })
  all[id] = list
  await kv.setItem(K_MARKS, all)
  return list
}

export async function removeMark(id, offset) {
  const all = await getMarksAll()
  const list = Array.isArray(all[id]) ? all[id] : []
  all[id] = list.filter(m => m.offset !== offset)
  await kv.setItem(K_MARKS, all)
  return all[id]
}

export async function getSettings() {
  const s = await kv.getItem(K_SETTINGS, {})
  return Object.assign({}, DEFAULT_SETTINGS, s && typeof s === 'object' ? s : {})
}

export async function saveSettings(patch) {
  const s = await getSettings()
  const next = Object.assign({}, s, patch)
  await kv.setItem(K_SETTINGS, next)
  return next
}

export function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = n => (n < 10 ? '0' + n : '' + n)
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
