// 纯逻辑：屏幕几何（横屏 800×254，cfg direction=270）
export const SCREEN = { w: 800, h: 254 }

// 横屏版式参数：内容区 760×188
export function landscapeLayout(fontSize) {
  const contentW = 760
  const contentH = 188
  const lineHeight = fontSize + 10
  return {
    contentW,
    contentH,
    lineHeight,
    charsPerLine: Math.floor(contentW / fontSize),
    linesPerPage: Math.floor(contentH / lineHeight),
  }
}
