<template>
  <div :class="['rroot', 'th' + theme + 'Bg']">
    <!-- 阅读内容层 -->
    <div class="head">
      <div class="backbtn press" @click="goBack"><text :class="['backtext', 'th' + theme + 'Mut']">〈 书架</text></div>
      <text :class="['title', 'th' + theme + 'Mut']">{{ titleDisplay }}</text>
      <div class="markbtn press" @click="addMarkHere($event)"><text class="marktext" :class="pageMarked ? 'markon' : 'markoff'">{{ pageMarked ? '★' : '☆' }}</text></div>
    </div>
    <div class="body">
      <scroller class="pagescroller" show-scrollbar="false">
        <text :class="['pagetext', 'fs' + fontSize, 'th' + theme + 'Text']">{{ pageText }}</text>
      </scroller>
    </div>
    <div class="foot">
      <text :class="['foottext', 'th' + theme + 'Mut']">{{ pageTextShort }}</text>
      <div class="footbar"><text class="footfill" :class="'ff' + pctStep"> </text></div>
      <text :class="['foottext', 'th' + theme + 'Mut']">{{ pct }}%</text>
    </div>

    <!-- 手势层：左/中/右三个点击分区（click 驱动，不依赖坐标解析），touch 事件只负责滑动检测 -->
    <div class="gestures">
      <div class="gz gzL" @click="onZoneLeft($event)" @touchstart="onTouchStart" @touchend="onTouchEnd"></div>
      <div class="gz gzM" @click="onZoneCenter($event)" @touchstart="onTouchStart" @touchend="onTouchEnd"></div>
      <div class="gz gzR" @click="onZoneRight($event)" @touchstart="onTouchStart" @touchend="onTouchEnd"></div>
    </div>

    <!-- 屏幕两侧翻页键（点击模式显示；放在手势层之上保证可点） -->
    <div class="edge edgeL press" v-if="pageMode === 'tap'" @click="prevPage($event)"><text class="edgetext">〈</text></div>
    <div class="edge edgeR press" v-if="pageMode === 'tap'" @click="nextPage($event)"><text class="edgetext">〉</text></div>

    <!-- 侧边栏 -->
    <div class="mask" v-if="sidebarOpen" @click="closeSidebar">
      <div class="side" @click="noop($event)">
        <div class="srow sh">
          <text class="stitle">阅读设置</text>
          <div class="sclose press" @click="closeSidebar($event)"><text class="sclosetext">完成</text></div>
        </div>
        <div class="srow">
          <text class="slabel">字号</text>
          <div class="sseg press" @click="fontStep(-1, $event)"><text class="ssegtext">－</text></div>
          <div class="sfontbox"><text class="sfontval">{{ fontSize }}</text></div>
          <div class="sseg press" @click="fontStep(1, $event)"><text class="ssegtext">＋</text></div>
          <text class="slabel2">阅读</text>
          <div class="spair">
            <div class="sopt press" :class="pageMode === 'swipe' ? 'opton' : 'optoff'" @click="setMode('swipe', $event)"><text class="sopttext" :class="pageMode === 'swipe' ? 'optontext' : 'optofftext'">滑动</text></div>
            <div class="sopt press" :class="pageMode === 'tap' ? 'opton' : 'optoff'" @click="setMode('tap', $event)"><text class="sopttext" :class="pageMode === 'tap' ? 'optontext' : 'optofftext'">点击</text></div>
          </div>
        </div>
        <div class="srow">
          <text class="slabel">背景</text>
          <scroller class="themesw" show-scrollbar="false" scroll-direction="horizontal">
            <div v-for="(t, i) in themeList" :key="i" class="chipbox press" @click="setTheme(i, $event)">
              <div :class="theme === i ? 'chip chipOn' : 'chip chipOff th' + i + 'Sw'"><text class="chiptext">{{ theme === i ? '✓' : ' ' }}</text></div>
              <text class="chiplabel">{{ t.name }}</text>
            </div>
          </scroller>
        </div>
        <div class="srow">
          <div class="sjump press" @click="jump(-10, $event)"><text class="sjumptext">−10页</text></div>
          <text class="spageinfo">{{ pageTextShort }}</text>
          <div class="sjump press" @click="jump(10, $event)"><text class="sjumptext">+10页</text></div>
        </div>
        <div class="smarks">
          <div class="smarksh"><text class="slabel">书签 {{ marks.length }}</text></div>
          <scroller class="marklist" show-scrollbar="false">
            <div class="mrow0" v-if="marks.length === 0"><text class="markempty">点右上角 ☆ 收藏当前页</text></div>
            <div v-for="(m, i) in marks" :key="m.offset" class="markrow">
              <div class="markmain press" @click="gotoMark(m, $event)">
                <text class="markpage">P{{ markPage(m) + 1 }}</text>
                <text class="markpreview">{{ m.preview }}</text>
              </div>
              <div class="markdel press" @click="delMark(m, $event)"><text class="markdeltext">删</text></div>
              <div class="msep" v-if="i < marks.length - 1"></div>
            </div>
          </scroller>
        </div>
        <div class="sfoot">
          <div class="sback press" @click="goBack($event)"><text class="sbacktext">返回书架</text></div>
        </div>
      </div>
    </div>

    <app-toast></app-toast>
  </div>
</template>

<script>
import fs from '../../utils/pen-fs.js'
import * as lib from '../../utils/library.js'
import { normalizeRawText, encodingWarning } from '../../utils/text.js'
import { IncrementalPaginator, pageOfOffset, pageCount, previewOf } from '../../utils/paginator.js'
import { landscapeLayout } from '../../utils/coords.js'
import { THEMES, clampTheme } from '../../utils/themes.js'
import appToast from '../../components/app-toast.vue'

const FONT_SIZES = [18, 20, 22, 24, 26]

export default {
  components: { 'app-toast': appToast },
  data() {
    return {
      title: '…',
      fontSize: 22,
      pageMode: 'tap',
      theme: 0,
      themeList: THEMES,
      page: 0,
      offsets: [0, 0],
      marks: [],
      sidebarOpen: false,
      pagingPct: 100,
      ready: false,
      pct: 0,
      pctStep: 1
    }
  },
  computed: {
    titleDisplay() {
      return this.pagingPct < 100 ? '排版中 ' + this.pagingPct + '%' : this.title
    },
    pageText() {
      const t = this._text || ''
      const a = this.offsets[this.page] || 0
      const b = this.offsets[this.page + 1] != null ? this.offsets[this.page + 1] : a
      return t.slice(a, b) || '（本页为空）'
    },
    pageTextShort() {
      return '第 ' + (this.page + 1) + ' / ' + pageCount(this.offsets) + ' 页'
    },
    pageMarked() {
      const t = this._text || ''
      const a = this.offsets[this.page] || 0
      const b = this.offsets[this.page + 1] != null ? this.offsets[this.page + 1] : a
      return this.marks.some(m => m.offset >= a && (m.offset < b || (a === b && m.offset === a)))
    }
  },
  methods: {
    toast(text) {
      $falcon.trigger('shuge-toast', { text })
    },
    stop(e) {
      try { if (e && typeof e.stopPropagation === 'function') e.stopPropagation() } catch (err) { /* 忽略 */ }
    },
    noop(e) { this.stop(e) },
    goBack(e) {
      this.stop(e)
      this.flushSave()
      this.$page.finish()
    },
    layout() {
      return landscapeLayout(this.fontSize)
    },
    repaginate(keepOffset) {
      const lay = this.layout()
      this._paginator = new IncrementalPaginator(this._text || '', lay.charsPerLine, lay.linesPerPage)
      this._pendingKeep = keepOffset || 0
      this.offsets = [0]
      this.page = 0
      this.pagingPct = 0
      this.runPaging()
    },
    runPaging() {
      if (this._pagingTimer) clearTimeout(this._pagingTimer)
      const tick = () => {
        const pg = this._paginator
        if (!pg) return
        pg.step(160000)
        this.offsets = pg.offsets.slice()
        this.pagingPct = pg.progress()
        if (!pg.done) {
          this._pagingTimer = setTimeout(tick, 0)
          return
        }
        this.pagingPct = 100
        const keep = this._pendingKeep || 0
        this._pendingKeep = 0
        this.page = Math.min(pageOfOffset(pg.offsets, keep), pageCount(pg.offsets) - 1)
        this.updatePct()
        this.queueSave()
      }
      tick()
    },
    updatePct() {
      const total = pageCount(this.offsets)
      this.pct = Math.min(100, Math.round((this.page + 1) * 100 / total))
      this.pctStep = Math.max(1, Math.round(this.pct / 10))
    },
    async load(options) {
      const id = options.id
      const path = options.path
      if (!id || !path) {
        this.toast('参数缺失，返回书架')
        this.$page.finish()
        return
      }
      this._id = id
      this.title = lib.titleFromPath(path)
      try {
        const raw = await fs.readText(path)
        const { text, lossy } = normalizeRawText(raw)
        this._text = text
        if (lossy) this.toast(encodingWarning(true))
        const settings = await lib.getSettings()
        this.fontSize = settings.fontSize
        // 旧版本的 keys 模式并入点击翻页
        this.pageMode = settings.pageMode === 'swipe' ? 'swipe' : 'tap'
        this.theme = clampTheme(settings.theme)
        this.marks = await lib.getMarks(id)
        const prog = await lib.getProgress(id)
        this.repaginate(prog ? prog.offset : 0)
        this.ready = true
      } catch (e) {
        this.toast('打开失败：' + path)
        setTimeout(() => this.$page.finish(), 1500)
      }
    },
    turn(delta) {
      const total = pageCount(this.offsets)
      const next = Math.min(total - 1, Math.max(0, this.page + delta))
      if (next !== this.page) {
        this.page = next
        this.updatePct()
        this.queueSave()
        return
      }
      if (delta > 0 && this.pagingPct < 100) this.toast('后面还在排版，稍等几秒')
      else if (delta > 0) this.toast('已经是最后一页')
      else if (delta < 0) this.toast('已经是第一页')
    },
    nextPage(e) { this.stop(e); this.turn(1) },
    prevPage(e) { this.stop(e); this.turn(-1) },
    jump(delta, e) {
      this.stop(e)
      if (this.pagingPct < 100 && delta > 0) { this.toast('后面还在排版，稍等几秒'); return }
      this.turn(delta)
    },
    gotoMark(m, e) {
      this.stop(e)
      const last = this.offsets[this.offsets.length - 1] || 0
      if (this.pagingPct < 100 && m.offset > last) {
        this.toast('目标页还没排版好，稍后再试')
        return
      }
      this.page = Math.min(pageOfOffset(this.offsets, m.offset), pageCount(this.offsets) - 1)
      this.updatePct()
      this.queueSave()
      this.sidebarOpen = false
    },
    async addMarkHere(e) {
      this.stop(e)
      const id = this._id
      const offset = this.offsets[this.page] || 0
      const list = await lib.addMark(id, { offset, preview: previewOf(this._text || '', offset) })
      this.marks = list
      this.toast('已添加书签')
    },
    async delMark(m, e) {
      this.stop(e)
      this.marks = await lib.removeMark(this._id, m.offset)
    },
    markPage(m) {
      return pageOfOffset(this.offsets, m.offset)
    },
    setMode(mode, e) {
      this.stop(e)
      this.pageMode = mode
      lib.saveSettings({ pageMode: mode })
    },
    setTheme(i, e) {
      this.stop(e)
      this.theme = clampTheme(i)
      lib.saveSettings({ theme: this.theme })
    },
    fontStep(dir, e) {
      this.stop(e)
      const i = FONT_SIZES.indexOf(this.fontSize)
      const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))]
      this.applyFontSize(next)
    },
    applyFontSize(size) {
      if (size === this.fontSize) return
      const keep = this.offsets[this.page] || 0
      this.fontSize = size
      lib.saveSettings({ fontSize: size })
      this.repaginate(keep)
    },
    // 三个点击分区：左=上一页，右=下一页，中=侧边栏（click 驱动，两种阅读方式都可用）
    onZoneLeft(e) {
      this.stop(e)
      if (this._suppressClick) return
      this.prevPage()
    },
    onZoneRight(e) {
      this.stop(e)
      if (this._suppressClick) return
      this.nextPage()
    },
    onZoneCenter(e) {
      this.stop(e)
      if (this._suppressClick) return
      this.sidebarOpen = true
    },
    onTouchStart(e) {
      const p = touchPoint(e)
      this._touch = p ? { x: p.x, y: p.y, t: Date.now() } : null
    },
    onTouchEnd(e) {
      const start = this._touch
      this._touch = null
      if (!start || this.sidebarOpen) return
      const p = touchPoint(e)
      if (!p) return // 坐标不可用时仍有 click 分区兜底
      const dx = p.x - start.x
      const dy = p.y - start.y
      const dt = Date.now() - start.t
      if (dt < 700 && Math.abs(dy) < 70 && Math.abs(dx) > 60) {
        // 滑动翻页后抑制同一次触摸派生的 click，避免翻两页
        this._suppressClick = true
        const self = this
        setTimeout(() => { self._suppressClick = false }, 450)
        if (dx < 0) this.nextPage()
        else this.prevPage()
      }
    },
    closeSidebar(e) {
      this.stop(e)
      this.sidebarOpen = false
    },
    queueSave() {
      if (this._saveTimer) clearTimeout(this._saveTimer)
      this._saveTimer = setTimeout(() => {
        this._saveTimer = null
        this.flushSave()
      }, 600)
    },
    flushSave() {
      if (!this.ready) return
      const id = this._id
      const offset = this.offsets[this.page] || 0
      lib.saveProgress(id, offset, this.page, pageCount(this.offsets))
    }
  },
  mounted() {
    const options = (this.$page && this.$page.options) || {}
    this._id = options.id
    this._text = ''
    this.load(options)
  },
  onShow() {},
  onHide() {
    this.flushSave()
  },
  onUnload() {
    this.flushSave()
    if (this._saveTimer) clearTimeout(this._saveTimer)
    if (this._pagingTimer) clearTimeout(this._pagingTimer)
  }
}

function touchPoint(e) {
  try {
    const arr = (e && e.changedTouches && e.changedTouches.length) ? e.changedTouches
      : ((e && e.touches && e.touches.length) ? e.touches : null)
    const t = arr ? arr[0] : e
    if (t) {
      const xs = ['pageX', 'clientX', 'screenX', 'x', 'offsetX']
      const ys = ['pageY', 'clientY', 'screenY', 'y', 'offsetY']
      for (let a = 0; a < xs.length; a++) {
        if (typeof t[xs[a]] === 'number') {
          for (let b = 0; b < ys.length; b++) {
            if (typeof t[ys[b]] === 'number') return { x: t[xs[a]], y: t[ys[b]] }
          }
        }
      }
    }
  } catch (err) { /* 事件形态异常 */ }
  return null
}
</script>

<style lang="less" scoped>
@import "../../styles/common.less";

.rroot {
  width: 100vw;
  height: 100vh;
  position: relative;
}
.th0Bg { background-color: #0b0f14; }
.th1Bg { background-color: #101828; }
.th2Bg { background-color: #0f1a14; }
.th3Bg { background-color: #211d15; }
.th4Bg { background-color: #000000; }
.th5Bg { background-color: #e8e4da; }
.th0Text { color: #d7e2e8; }
.th1Text { color: #c9d6ea; }
.th2Text { color: #cfe6d4; }
.th3Text { color: #e6dcc3; }
.th4Text { color: #b8c0c6; }
.th5Text { color: #33322e; }
.th0Mut { color: #5c7182; }
.th1Mut { color: #5a6c85; }
.th2Mut { color: #5d7a67; }
.th3Mut { color: #8a8069; }
.th4Mut { color: #555f66; }
.th5Mut { color: #8a867c; }
.th0Sw { background-color: #0b0f14; }
.th1Sw { background-color: #101828; }
.th2Sw { background-color: #0f1a14; }
.th3Sw { background-color: #211d15; }
.th4Sw { background-color: #000000; }
.th5Sw { background-color: #e8e4da; }

.head {
  position: absolute;
  left: 0vw;
  top: 0vh;
  width: 100vw;
  height: 15.75vh;
  flex-direction: row;
  align-items: center;
  padding-left: 1vw;
  padding-right: 1vw;
}
.backbtn { width: 12vw; height: 12.6vh; justify-content: center; }
.backtext { font-size: 5.51vh; }
.title {
  flex: 1;
  font-size: 5.12vh;
  text-align: center;
  lines: 1;
  text-overflow: ellipsis;
}
.markbtn { width: 7.5vw; height: 12.6vh; align-items: center; justify-content: center; }
.marktext { font-size: 7.09vh; }
.markon { color: #f5b85c; }
.markoff { color: #3a4c5c; }

.body {
  position: absolute;
  left: 2.5vw;
  top: 15.75vh;
  width: 95vw;
  height: 74.8vh;
}
.pagescroller { width: 95vw; height: 74.8vh; }
.pagetext { text-align: left; }
.fs18 { font-size: 7.09vh; line-height: 11.02vh; }
.fs20 { font-size: 7.87vh; line-height: 11.81vh; }
.fs22 { font-size: 8.66vh; line-height: 12.6vh; }
.fs24 { font-size: 9.45vh; line-height: 13.39vh; }
.fs26 { font-size: 10.24vh; line-height: 14.17vh; }

.foot {
  position: absolute;
  left: 2.5vw;
  bottom: 2.36vh;
  width: 95vw;
  height: 7.09vh;
  flex-direction: row;
  align-items: center;
}
.foottext { font-size: 4.33vh; }
.footbar {
  flex: 1;
  height: 1.18vh;
  margin-left: 1.5vw;
  margin-right: 1.5vw;
  border-radius: 0.25vw;
  background-color: #19242f;
}
.footfill { height: 1.18vh; border-radius: 0.25vw; background-color: #4fd6c3; }
.ff1 { width: 9.5vw; }
.ff2 { width: 19vw; }
.ff3 { width: 28.5vw; }
.ff4 { width: 38vw; }
.ff5 { width: 47.5vw; }
.ff6 { width: 57vw; }
.ff7 { width: 66.5vw; }
.ff8 { width: 76vw; }
.ff9 { width: 85.5vw; }
.ff10 { width: 95vw; }

.edge {
  position: absolute;
  top: 37.8vh;
  width: 5.5vw;
  height: 30.71vh;
  border-radius: 1.25vw;
  background-color: #16202a;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
  z-index: 3;
}
.edgeL { left: 0.75vw; }
.edgeR { right: 0.75vw; }
.edgetext { color: #4fd6c3; font-size: 8.66vh; }

.gestures {
  position: absolute;
  left: 0vw;
  top: 0vh;
  width: 100vw;
  height: 100vh;
  z-index: 2;
}
.gz {
  position: absolute;
  top: 0vh;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.001);
}
.gzL { left: 0vw; width: 25vw; }
.gzM { left: 25vw; width: 50vw; }
.gzR { left: 75vw; width: 25vw; }

.mask {
  position: absolute;
  left: 0vw;
  top: 0vh;
  width: 100vw;
  height: 100vh;
  background-color: rgba(5, 8, 12, 0.6);
  z-index: 10;
}
.side {
  position: absolute;
  left: 0vw;
  top: 0vh;
  width: 37.5vw;
  height: 100vh;
  background-color: #121922;
  border-right-width: 1px;
  border-color: #263340;
  padding-top: 3.15vh;
  padding-bottom: 2.36vh;
  padding-left: 1.75vw;
  padding-right: 1.75vw;
  z-index: 11;
}
.srow { flex-direction: row; align-items: center; margin-top: 2.36vh; }
.sh { margin-top: 0vh; justify-content: space-between; }
.stitle { color: #e8eef2; font-size: 5.51vh; font-weight: bold; }
.sclose {
  min-width: 6.5vw;
  height: 9.45vh;
  border-radius: 0.88vw;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
}
.sclosetext { color: #4fd6c3; font-size: 4.72vh; }
.slabel { color: #8ca0ad; font-size: 4.72vh; width: 4.25vw; }
.slabel2 { color: #8ca0ad; font-size: 4.72vh; margin-left: 2.25vw; }
.sseg {
  width: 4.25vw;
  height: 10.24vh;
  border-radius: 0.88vw;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
  margin-left: 1vw;
}
.ssegtext { color: #e8eef2; font-size: 5.12vh; }
.sfontbox { width: 4.75vw; height: 10.24vh; align-items: center; justify-content: center; }
.sfontval { color: #4fd6c3; font-size: 5.12vh; }
.spair {
  flex-direction: row;
  margin-left: 1vw;
  border-radius: 0.88vw;
  border-width: 1px;
  border-color: #263340;
  overflow: hidden;
}
.sopt { width: 5.5vw; height: 10.24vh; align-items: center; justify-content: center; }
.opton { background-color: #123a37; }
.optoff { background-color: #19242f; }
.sopttext { font-size: 4.33vh; }
.optontext { color: #4fd6c3; }
.optofftext { color: #8ca0ad; }

.themesw { width: 29.75vw; height: 18.11vh; }
.chipbox { width: 4.88vw; align-items: center; }
.chip {
  width: 3.25vw;
  height: 10.24vh;
  border-radius: 0.88vw;
  align-items: center;
  justify-content: center;
}
.chipOn { background-color: #4fd6c3; border-width: 2px; border-color: #4fd6c3; }
.chipOff { border-width: 1px; border-color: #263340; }
.chiptext { color: #0b0f14; font-size: 5.12vh; font-weight: bold; }
.chiplabel { color: #8ca0ad; font-size: 3.54vh; margin-top: 0.79vh; }

.sjump {
  width: 7.75vw;
  height: 10.24vh;
  border-radius: 0.88vw;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
}
.sjumptext { color: #8ca0ad; font-size: 4.33vh; }
.spageinfo { flex: 1; color: #4fd6c3; font-size: 4.33vh; text-align: center; }

.smarks { margin-top: 2.36vh; }
.smarksh { height: 7.09vh; }
.marklist { width: 34vw; height: 23.62vh; }
.mrow0 { padding: 0.5vw; }
.markempty { color: #5c7182; font-size: 4.33vh; }
.markrow { flex-direction: row; align-items: center; height: 11.02vh; }
.markmain { flex: 1; flex-direction: row; align-items: center; }
.markpage { color: #f5b85c; font-size: 4.33vh; width: 5vw; }
.markpreview {
  flex: 1;
  color: #8ca0ad;
  font-size: 4.33vh;
  lines: 1;
  text-overflow: ellipsis;
  margin-right: 1vw;
}
.markdel {
  width: 4.25vw;
  height: 8.66vh;
  border-radius: 0.75vw;
  background-color: #19242f;
  align-items: center;
  justify-content: center;
}
.markdeltext { color: #ff6b72; font-size: 3.94vh; }
.msep { position: absolute; left: 0vw; bottom: 0vh; width: 34vw; height: 0.39vh; background-color: #1b2530; }

.sfoot { margin-top: 1.97vh; flex-direction: row; }
.sback {
  width: 34vw;
  height: 10.24vh;
  border-radius: 1vw;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
}
.sbacktext { color: #8ca0ad; font-size: 4.72vh; }
</style>
