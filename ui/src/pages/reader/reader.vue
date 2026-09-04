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

    <!-- 点击翻页模式的屏幕两侧翻页键 -->
    <div class="edge edgeL press" v-if="pageMode === 'tap'" @click="prevPage()"><text class="edgetext">〈</text></div>
    <div class="edge edgeR press" v-if="pageMode === 'tap'" @click="nextPage()"><text class="edgetext">〉</text></div>

    <!-- 触摸层：滑动翻页 / 点击分区翻页，其余唤出侧边栏 -->
    <div class="touch" @touchstart="onTouchStart" @touchend="onTouchEnd"></div>

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
    nextPage() { this.turn(1) },
    prevPage() { this.turn(-1) },
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
    onTouchStart(e) {
      const p = touchPoint(e)
      this._touch = p ? { x: p.x, y: p.y, t: Date.now() } : null
    },
    onTouchEnd(e) {
      const start = this._touch
      this._touch = null
      if (!start || this.sidebarOpen) return
      const p = touchPoint(e)
      if (!p) return
      const dx = p.x - start.x
      const dy = p.y - start.y
      const dt = Date.now() - start.t
      if (dt < 700 && Math.abs(dy) < 60) {
        if (this.pageMode === 'swipe' && dx < -60) { this.nextPage(); return }
        if (this.pageMode === 'swipe' && dx > 60) { this.prevPage(); return }
      }
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24 && dt < 500) {
        if (this.pageMode === 'tap') {
          if (p.x < 200) { this.prevPage(); return }
          if (p.x > 600) { this.nextPage(); return }
        }
        this.sidebarOpen = true
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
    if (e && e.changedTouches && e.changedTouches.length) return e.changedTouches[0]
    if (e && e.touches && e.touches.length) return e.touches[0]
    if (e && typeof e.pageX === 'number') return e
  } catch (err) { /* 事件形态异常 */ }
  return null
}
</script>

<style lang="less" scoped>
@import "../../styles/common.less";

.rroot {
  width: 800px;
  height: 254px;
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
.backtext { font-size: 14px; }
.title {
  flex: 1;
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
.pagetext { text-align: left; }
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
.foottext { font-size: 11px; }
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
  background-color: rgba(5, 8, 12, 0.6);
  z-index: 10;
}
.side {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 300px;
  height: 254px;
  background-color: #121922;
  border-right-width: 1px;
  border-color: #263340;
  padding-top: 8px;
  padding-bottom: 6px;
  padding-left: 14px;
  padding-right: 14px;
  z-index: 11;
}
.srow { flex-direction: row; align-items: center; margin-top: 6px; }
.sh { margin-top: 0px; justify-content: space-between; }
.stitle { color: #e8eef2; font-size: 14px; font-weight: bold; }
.sclose {
  min-width: 52px;
  height: 24px;
  border-radius: 7px;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
}
.sclosetext { color: #4fd6c3; font-size: 12px; }
.slabel { color: #8ca0ad; font-size: 12px; width: 34px; }
.slabel2 { color: #8ca0ad; font-size: 12px; margin-left: 18px; }
.sseg {
  width: 34px;
  height: 26px;
  border-radius: 7px;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}
.ssegtext { color: #e8eef2; font-size: 13px; }
.sfontbox { width: 38px; height: 26px; align-items: center; justify-content: center; }
.sfontval { color: #4fd6c3; font-size: 13px; }
.spair {
  flex-direction: row;
  margin-left: 8px;
  border-radius: 7px;
  border-width: 1px;
  border-color: #263340;
  overflow: hidden;
}
.sopt { width: 44px; height: 26px; align-items: center; justify-content: center; }
.opton { background-color: #123a37; }
.optoff { background-color: #19242f; }
.sopttext { font-size: 11px; }
.optontext { color: #4fd6c3; }
.optofftext { color: #8ca0ad; }

.themesw { width: 238px; height: 46px; }
.chipbox { width: 39px; align-items: center; }
.chip {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  align-items: center;
  justify-content: center;
}
.chipOn { background-color: #4fd6c3; border-width: 2px; border-color: #4fd6c3; }
.chipOff { border-width: 1px; border-color: #263340; }
.chiptext { color: #0b0f14; font-size: 13px; font-weight: bold; }
.chiplabel { color: #8ca0ad; font-size: 9px; margin-top: 2px; }

.sjump {
  width: 62px;
  height: 26px;
  border-radius: 7px;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
}
.sjumptext { color: #8ca0ad; font-size: 11px; }
.spageinfo { flex: 1; color: #4fd6c3; font-size: 11px; text-align: center; }

.smarks { margin-top: 6px; }
.smarksh { height: 18px; }
.marklist { width: 272px; height: 60px; }
.mrow0 { padding: 4px; }
.markempty { color: #5c7182; font-size: 11px; }
.markrow { flex-direction: row; align-items: center; height: 28px; }
.markmain { flex: 1; flex-direction: row; align-items: center; }
.markpage { color: #f5b85c; font-size: 11px; width: 40px; }
.markpreview {
  flex: 1;
  color: #8ca0ad;
  font-size: 11px;
  lines: 1;
  text-overflow: ellipsis;
  margin-right: 8px;
}
.markdel {
  width: 34px;
  height: 22px;
  border-radius: 6px;
  background-color: #19242f;
  align-items: center;
  justify-content: center;
}
.markdeltext { color: #ff6b72; font-size: 10px; }
.msep { position: absolute; left: 0px; bottom: 0px; width: 272px; height: 1px; background-color: #1b2530; }

.sfoot { margin-top: 5px; flex-direction: row; }
.sback {
  width: 272px;
  height: 26px;
  border-radius: 8px;
  background-color: #19242f;
  border-width: 1px;
  border-color: #263340;
  align-items: center;
  justify-content: center;
}
.sbacktext { color: #8ca0ad; font-size: 12px; }
</style>
