<template>
  <div class="screen">
    <!-- 阅读内容层 -->
    <div class="head">
      <div class="backbtn press" @click="goBack"><text class="backtext">〈 书架</text></div>
      <text class="title">{{ title }}</text>
      <div class="markbtn press" @click="addMarkHere"><text class="marktext" :class="pageMarked ? 'markon' : 'markoff'">{{ pageMarked ? '★' : '☆' }}</text></div>
    </div>
    <div class="body">
      <scroller class="pagescroller" show-scrollbar="false">
        <text class="pagetext" :class="'fs' + fontSize">{{ pageText }}</text>
      </scroller>
    </div>
    <div class="foot">
      <text class="foottext">{{ pageTextShort }}</text>
      <div class="footbar"><text class="footfill" :class="'ff' + pctStep"> </text></div>
      <text class="foottext">{{ pct }}%</text>
    </div>

    <!-- 按键模式的翻页按钮（覆盖在触摸层之上） -->
    <div class="edge edgeL press" v-if="pageMode === 'keys'" @click="prevPage"><text class="edgetext">〈</text></div>
    <div class="edge edgeR press" v-if="pageMode === 'keys'" @click="nextPage"><text class="edgetext">〉</text></div>

    <!-- 触摸层：点按切换菜单，滑动翻页 -->
    <div class="touch" @touchstart="onTouchStart" @touchend="onTouchEnd"></div>

    <!-- 菜单层 -->
    <div class="mask" v-if="menuOpen" @click="closeMenu">
      <div class="menu" @click="noop($event)">
        <div class="mrow">
          <text class="mtitle">阅读设置</text>
          <text class="mbook">{{ title }}</text>
          <div class="mbtn press" @click="closeMenu($event)"><text class="mbtnTextSolid">完成</text></div>
        </div>
        <div class="mrow2">
          <text class="mlabel">字号</text>
          <div class="seg press" @click="fontSmaller($event)"><text class="segtext">－</text></div>
          <div class="fontbox"><text class="fontval">{{ fontSize }}</text></div>
          <div class="seg press" @click="fontBigger($event)"><text class="segtext">＋</text></div>
          <text class="mlabel2">翻页</text>
          <div class="segpair">
            <div class="segopt press" :class="pageMode === 'keys' ? 'segon' : 'segoff'" @click="setMode('keys', $event)"><text class="segopttext" :class="pageMode === 'keys' ? 'segontext' : 'segofftext'">按键</text></div>
            <div class="segopt press" :class="pageMode === 'swipe' ? 'segon' : 'segoff'" @click="setMode('swipe', $event)"><text class="segopttext" :class="pageMode === 'swipe' ? 'segontext' : 'segofftext'">滑动</text></div>
          </div>
          <div class="mbtn press" @click="jump(-10, $event)"><text class="mbtntext">−10页</text></div>
          <div class="mbtn press" @click="jump(10, $event)"><text class="mbtntext">+10页</text></div>
        </div>
        <div class="mrow3">
          <div class="markline press" v-if="!showMarks" @click="openMarks($event)"><text class="marklinetext">书签 {{ marks.length }} 个 ></text></div>
          <scroller class="marklist" show-scrollbar="false" v-if="showMarks">
            <div class="mrow0" v-if="marks.length === 0"><text class="markempty">还没有书签。翻到想标记的页，点右上角 ☆。</text></div>
            <div v-for="(m, i) in marks" :key="m.offset" class="markrow">
              <div class="markmain press" @click="gotoMark(m, $event)">
                <text class="markpage">第 {{ markPage(m) + 1 }} 页</text>
                <text class="markpreview">{{ m.preview }}</text>
              </div>
              <div class="markdel press" @click="delMark(m, $event)"><text class="markdeltext">删</text></div>
              <div class="msep" v-if="i < marks.length - 1"></div>
            </div>
          </scroller>
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
import { paginate, pageOfOffset, pageCount, previewOf } from '../../utils/paginator.js'
import { landscapeLayout } from '../../utils/coords.js'
import appToast from '../../components/app-toast.vue'

export default {
  components: { 'app-toast': appToast },
  data() {
    return {
      title: '…',
      fontSize: 22,
      pageMode: 'keys',
      page: 0,
      offsets: [0, 0],
      marks: [],
      menuOpen: false,
      showMarks: false,
      ready: false,
      pct: 0,
      pctStep: 1
    }
  },
  computed: {
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
      this.offsets = paginate(this._text || '', lay.charsPerLine, lay.linesPerPage)
      this.page = Math.min(pageOfOffset(this.offsets, keepOffset), pageCount(this.offsets) - 1)
      this.updatePct()
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
      this.title = lib.titleFromPath(path)
      try {
        const raw = await fs.readText(path)
        const { text, lossy } = normalizeRawText(raw)
        if (lossy) this.toast(encodingWarning(true))
        const settings = await lib.getSettings()
        this.fontSize = settings.fontSize
        this.pageMode = settings.pageMode
        this.marks = await lib.getMarks(id)
        const prog = await lib.getProgress(id)
        this.repaginate(prog ? prog.offset : 0)
        this.ready = true
      } catch (e) {
        this.toast('打开失败：' + path)
        setTimeout(() => this.$page.finish(), 1200)
      }
    },
    turn(delta) {
      const total = pageCount(this.offsets)
      const next = Math.min(total - 1, Math.max(0, this.page + delta))
      if (next !== this.page) {
        this.page = next
        this.updatePct()
        this.queueSave()
      } else if (delta !== 0) {
        this.toast(delta > 0 ? '已经是最后一页' : '已经是第一页')
      }
    },
    nextPage() { this.turn(1) },
    prevPage() { this.turn(-1) },
    jump(delta, e) { this.stop(e); this.turn(delta) },
    gotoMark(m, e) {
      this.stop(e)
      this.page = Math.min(pageOfOffset(this.offsets, m.offset), pageCount(this.offsets) - 1)
      this.updatePct()
      this.queueSave()
      this.showMarks = false
      this.menuOpen = false
    },
    async addMarkHere() {
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
    openMarks(e) { this.stop(e); this.showMarks = true },
    setMode(mode, e) {
      this.stop(e)
      this.pageMode = mode
      lib.saveSettings({ pageMode: mode })
    },
    fontSmaller(e) {
      this.stop(e)
      const sizes = [18, 20, 22, 24, 26]
      const i = sizes.indexOf(this.fontSize)
      this.applyFontSize(sizes[Math.max(0, (i < 0 ? 2 : i) - 1)])
    },
    fontBigger(e) {
      this.stop(e)
      const sizes = [18, 20, 22, 24, 26]
      const i = sizes.indexOf(this.fontSize)
      this.applyFontSize(sizes[Math.min(sizes.length - 1, (i < 0 ? 2 : i) + 1)])
    },
    applyFontSize(size) {
      if (size === this.fontSize) return
      const keep = this.offsets[this.page] || 0
      this.fontSize = size
      lib.saveSettings({ fontSize: size })
      this.repaginate(keep)
    },
    onTouchStart(e) {
      const p = touchPoint(e)
      this._touch = p ? { x: p.x, y: p.y, t: Date.now() } : null
    },
    onTouchEnd(e) {
      const start = this._touch
      this._touch = null
      if (!start || this.menuOpen) return
      const p = touchPoint(e)
      if (!p) return
      const dx = p.x - start.x
      const dy = p.y - start.y
      const dt = Date.now() - start.t
      if (this.pageMode === 'swipe' && dt < 700) {
        if (dx < -60 && Math.abs(dy) < 60) { this.nextPage(); return }
        if (dx > 60 && Math.abs(dy) < 60) { this.prevPage(); return }
      }
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24 && dt < 500) {
        this.menuOpen = true
      }
    },
    closeMenu(e) {
      this.stop(e)
      this.menuOpen = false
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
  }
}

function touchPoint(e) {
  try {
    if (e && e.changedTouches && e.changedTouches.length) return e.changedTouches[0]
    if (e && e.touches && e.touches.length) return e.touches[0]
    if (e && typeof e.pageX === 'number') return e
  } catch (err) { /* 事件形态异常 */ }
  return null
}
</script>

<style lang="less" scoped>
@import "../../styles/common.less";

.head {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 40px;
  flex-direction: row;
  align-items: center;
  padding-left: 8px;
  padding-right: 8px;
}
.backbtn { width: 96px; height: 32px; justify-content: center; }
.backtext { color: #8ca0ad; font-size: 14px; }
.title {
  flex: 1;
  color: #8ca0ad;
  font-size: 13px;
  text-align: center;
  lines: 1;
  text-overflow: ellipsis;
}
.markbtn { width: 60px; height: 32px; align-items: center; justify-content: center; }
.marktext { font-size: 18px; }
.markon { color: #f5b85c; }
.markoff { color: #3a4c5c; }

.body {
  position: absolute;
  left: 20px;
  top: 40px;
  width: 760px;
  height: 190px;
}
.pagescroller { width: 760px; height: 190px; }
.pagetext { color: #d7e2e8; text-align: left; }
.fs18 { font-size: 18px; line-height: 28px; }
.fs20 { font-size: 20px; line-height: 30px; }
.fs22 { font-size: 22px; line-height: 32px; }
.fs24 { font-size: 24px; line-height: 34px; }
.fs26 { font-size: 26px; line-height: 36px; }

.foot {
  position: absolute;
  left: 20px;
  bottom: 6px;
  width: 760px;
  height: 18px;
  flex-direction: row;
  align-items: center;
}
.foottext { color: #5c7182; font-size: 11px; }
.footbar {
  flex: 1;
  height: 3px;
  margin-left: 12px;
  margin-right: 12px;
  border-radius: 2px;
  background-color: #19242f;
}
.footfill { height: 3px; border-radius: 2px; background-color: #4fd6c3; }
.ff1 { width: 76px; }
.ff2 { width: 152px; }
.ff3 { width: 228px; }
.ff4 { width: 304px; }
.ff5 { width: 380px; }
.ff6 { width: 456px; }
.ff7 { width: 532px; }
.ff8 { width: 608px; }
.ff9 { width: 684px; }
.ff10 { width: 760px; }

.edge {
  position: absolute;
  top: 96px;
  width: 44px;
  height: 78px;
  border-radius: 10px;
  background-color: #16202a;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
  z-index: 3;
}
.edgeL { left: 6px; }
.edgeR { right: 6px; }
.edgetext { color: #4fd6c3; font-size: 22px; }

.touch {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 254px;
  z-index: 2;
  background-color: rgba(0, 0, 0, 0.001);
}

.mask {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 254px;
  background-color: rgba(5, 8, 12, 0.82);
  z-index: 10;
}
.menu {
  position: absolute;
  left: 14px;
  top: 12px;
  width: 772px;
  height: 230px;
  background-color: #121922;
  border-radius: 12px;
  border-width: 1px;
  border-color: #263340;
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: 14px;
  padding-right: 14px;
}
.mrow { flex-direction: row; align-items: center; }
.mtitle { color: #e8eef2; font-size: 15px; font-weight: bold; width: 90px; }
.mbook {
  flex: 1;
  color: #5c7182;
  font-size: 11px;
  lines: 1;
  text-overflow: ellipsis;
}
.mbtn {
  min-width: 66px;
  height: 30px;
  border-radius: 8px;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  padding-left: 8px;
  padding-right: 8px;
}
.mbtntext { color: #8ca0ad; font-size: 12px; }
.mbtnTextSolid { color: #4fd6c3; font-size: 12px; }

.mrow2 {
  flex-direction: row;
  align-items: center;
  margin-top: 10px;
}
.mlabel { color: #8ca0ad; font-size: 12px; }
.mlabel2 { color: #8ca0ad; font-size: 12px; margin-left: 26px; }
.seg {
  width: 40px;
  height: 30px;
  border-radius: 8px;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}
.segtext { color: #e8eef2; font-size: 15px; }
.fontbox {
  width: 44px;
  height: 30px;
  align-items: center;
  justify-content: center;
}
.fontval { color: #4fd6c3; font-size: 15px; }
.segpair {
  flex-direction: row;
  margin-left: 8px;
  border-radius: 8px;
  border-width: 1px;
  border-color: #263340;
  overflow: hidden;
}
.segopt { width: 54px; height: 30px; align-items: center; justify-content: center; }
.segon { background-color: #123a37; }
.segoff { background-color: #19242f; }
.segopttext { font-size: 12px; }
.segontext { color: #4fd6c3; }
.segofftext { color: #8ca0ad; }

.mrow3 { margin-top: 10px; }
.markline { height: 34px; justify-content: center; }
.marklinetext { color: #8ca0ad; font-size: 13px; }
.marklist { width: 744px; height: 120px; }
.mrow0 { padding: 8px; }
.markempty { color: #5c7182; font-size: 12px; }
.markrow { flex-direction: row; align-items: center; height: 34px; }
.markmain { flex: 1; flex-direction: row; align-items: center; }
.markpage { color: #f5b85c; font-size: 12px; width: 64px; }
.markpreview {
  flex: 1;
  color: #8ca0ad;
  font-size: 12px;
  lines: 1;
  text-overflow: ellipsis;
  margin-right: 10px;
}
.markdel {
  width: 40px;
  height: 26px;
  border-radius: 7px;
  background-color: #19242f;
  align-items: center;
  justify-content: center;
}
.markdeltext { color: #ff6b72; font-size: 11px; }
.msep { position: absolute; left: 0px; bottom: 0px; width: 744px; height: 1px; background-color: #1b2530; }
</style>
