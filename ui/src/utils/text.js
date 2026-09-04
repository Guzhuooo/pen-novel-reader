// 纯逻辑：文本规范化与编码检测（可被 node --test 直接测试）

// 探针实测：设备 readText 将 GBK 字节替换为 U+FFFD（有损），UTF-8 正常。
export function normalizeRawText(raw) {
  let text = String(raw == null ? '' : raw)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const lossy = text.indexOf('\ufffd') !== -1
  text = text.replace(/\r\n?/g, '\n')
  // 去掉文首/文末多余空行，保留段内结构
  text = text.replace(/^\n+/, '').replace(/\n+$/, '')
  return { text, lossy }
}

export function encodingWarning(lossy) {
  return lossy
    ? '该文件不是 UTF-8 编码（可能是 GBK），部分字符无法显示。请用电脑转换为 UTF-8 后再复制进笔里。'
    : ''
}

// 全角/CJK 记 1 个字宽，半角记 0.55
export function charUnits(ch) {
  const c = ch.codePointAt(0)
  if (c === 10) return 0
  if (c >= 0x2e80 || (c >= 0xff01 && c <= 0xff60) || (c >= 0x3000 && c <= 0x303f)) return 1
  return 0.55
}
