// 阅读主题预设：bg 背景 / text 正文 / mut 次要文字（标题、页脚）
export const THEMES = [
  { name: '曜石', bg: '#0b0f14', text: '#d7e2e8', mut: '#5c7182' },
  { name: '墨蓝', bg: '#101828', text: '#c9d6ea', mut: '#5a6c85' },
  { name: '暗森', bg: '#0f1a14', text: '#cfe6d4', mut: '#5d7a67' },
  { name: '羊皮', bg: '#211d15', text: '#e6dcc3', mut: '#8a8069' },
  { name: '纯黑', bg: '#000000', text: '#b8c0c6', mut: '#555f66' },
  { name: '米白', bg: '#e8e4da', text: '#33322e', mut: '#8a867c' },
]

export function clampTheme(i) {
  const n = THEMES.length
  let v = Number(i)
  if (!isFinite(v)) return 0
  v = Math.floor(v)
  if (v < 0) return 0
  if (v >= n) return n - 1
  return v
}
