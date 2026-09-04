// 纯逻辑：屏幕几何与版式。
// 屏幕尺寸来自 utils/device.js 的运行时探测（任意词典笔自适应），
// 未探测前按 800×254 设计稿兜底；所有版式参数按设计稿比例推导。
export let SCREEN = { w: 800, h: 254 }

export function setScreen(w, h) {
  if (Number(w) > 0 && Number(h) > 0) SCREEN = { w: Number(w), h: Number(h) }
}

export function getScreen() {
  return SCREEN
}

// 横屏版式参数（按 800×254 设计稿比例推导）：
//   内容区 760×188（左右留 20、顶部 40、底部留 66 中 190 高）
//   字号以 vh 等比缩放：设计稿上 22px == 22 * H / 254
export function landscapeLayout(fontSize) {
  const contentW = SCREEN.w * 760 / 800
  const contentH = SCREEN.h * 190 / 254
  const fontPx = fontSize * SCREEN.h / 254
  const lineHeight = fontPx + SCREEN.h * 10 / 254
  return {
    contentW,
    contentH,
    lineHeight,
    fontPx,
    charsPerLine: Math.max(4, Math.floor(contentW / fontPx)),
    linesPerPage: Math.max(1, Math.floor(contentH / lineHeight)),
  }
}
