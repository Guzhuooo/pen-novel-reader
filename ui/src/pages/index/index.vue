<template>
  <div class="screen">
    <!-- 顶栏 -->
    <div class="topbar">
      <div class="brand">
        <div class="brandmark"><text class="brandglyph">阁</text></div>
        <div class="brandcol">
          <text class="brandtitle">书阁</text>
          <text class="brandsub">词典笔小说阅读器</text>
        </div>
      </div>
      <div class="topactions">
        <div class="btnGhost press" @click="goFiles"><text class="btnTextAccent">找小说</text></div>
      </div>
    </div>

    <!-- 继续阅读 -->
    <div class="hero press" v-if="lastBook" @click="openBook(lastBook.id, lastBook.path)">
      <div class="heroTop">
        <text class="herochip">继续阅读</text>
        <text class="herotitle">{{ lastBook.title }}</text>
        <text class="heropct">{{ heroPercent }}</text>
      </div>
      <div class="heroBot">
        <div class="herobar"><text class="herofill" :class="'wf' + heroStep"> </text></div>
        <text class="herotime">{{ lastWhen }}</text>
      </div>
    </div>

    <!-- 书架列表 -->
    <scroller :class="lastBook ? 'list listLow' : 'list'" show-scrollbar="false" v-if="books.length > 0">
      <div v-for="(b, i) in books" :key="b.id" class="row">
        <div class="cover press" @click="openBook(b.id, b.path)"><text class="coverglyph">{{ coverGlyph(b.title) }}</text></div>
        <div class="rowmain press" @click="openBook(b.id, b.path)">
          <text class="rowtitle">{{ b.title }}</text>
          <text class="rowmeta">{{ progressText(b) }}</text>
        </div>
        <div class="more press" @click="askBook(b)"><text class="moretext">···</text></div>
        <div class="sep" v-if="i < books.length - 1"></div>
      </div>
      <div class="listpad"></div>
    </scroller>

    <!-- 空态 -->
    <div :class="lastBook ? 'empty emptyLow' : 'empty'" v-if="books.length === 0">
      <text class="emptyglyph">［　书　］</text>
      <text class="emptytip">书架还是空的。笔里已经有 txt 小说了吗？</text>
      <div class="btnSolid press" @click="goFiles"><text class="btnTextDark">去笔里找小说</text></div>
    </div>

    <action-sheet :open="sheetOpen" :title="sheetTitle" :actions="sheetActions" @action="onSheetAction"></action-sheet>
    <app-toast></app-toast>
  </div>
</template>

<script>
import * as lib from '../../utils/library.js'
import actionSheet from '../../components/action-sheet.vue'
import appToast from '../../components/app-toast.vue'

export default {
  components: { 'action-sheet': actionSheet, 'app-toast': appToast },
  data() {
    return {
      books: [],
      prog: {},
      lastBook: null,
      heroPercent: '0%',
      heroStep: 0,
      lastWhen: '',
      sheetOpen: false,
      sheetTitle: '',
      sheetActions: [],
      sheetTarget: null
    }
  },
  methods: {
    coverGlyph(title) {
      const t = String(title || '书')
      return t.charAt(0)
    },
    progressText(b) {
      const p = this.prog[b.id]
      if (!p || !p.pageCount) return '尚未阅读'
      const pct = Math.min(100, Math.round(((p.page || 0) + 1) * 100 / p.pageCount))
      return '读到 ' + pct + '% · ' + lib.fmtTime(p.time)
    },
    goFiles() {
      $falcon.navTo('files')
    },
    openBook(id, path) {
      $falcon.navTo('reader', { id, path })
    },
    askBook(b) {
      this.sheetTarget = b
      this.sheetTitle = b.title
      this.sheetActions = [
        { label: '继续阅读', key: 'open' },
        { label: '移出书架', key: 'remove', danger: true }
      ]
      this.sheetOpen = true
    },
    async onSheetAction(key) {
      const target = this.sheetTarget
      this.sheetOpen = false
      if (!key || !target) return
      if (key === 'open') this.openBook(target.id, target.path)
      if (key === 'remove') {
        await lib.removeFromShelf(target.id)
        this.refresh()
        this.toast('已移出书架')
      }
    },
    toast(text) {
      $falcon.trigger('shuge-toast', { text })
    },
    async refresh() {
      try {
        const books = await lib.getShelf()
        const prog = await lib.getProgressAll()
        this.books = books
        this.prog = prog
        let last = null
        let lastTime = 0
        for (const b of books) {
          const p = prog[b.id]
          if (p && p.time > lastTime) { lastTime = p.time; last = b }
        }
        this.lastBook = last
        if (last) {
          const p = prog[last.id]
          const pct = p && p.pageCount ? Math.min(100, Math.round(((p.page || 0) + 1) * 100 / p.pageCount)) : 0
          this.heroPercent = pct + '%'
          this.heroStep = Math.max(1, Math.round(pct / 10))
          this.lastWhen = lib.fmtTime(p ? p.time : 0)
        }
      } catch (e) {
        this.toast('书架加载失败 ' + e)
      }
    }
  },
  mounted() {
    this.refresh()
  },
  onShow() {
    this.refresh()
  },
  onHide() {},
  onUnload() {}
}
</script>

<style lang="less" scoped>
@import "../../styles/common.less";

.topbar {
  position: absolute;
  left: 0vw;
  top: 0vh;
  width: 100vw;
  height: 20.47vh;
  flex-direction: row;
  align-items: center;
  padding-left: 2vw;
  padding-right: 2vw;
  border-bottom-width: 1px;
  border-color: #1b2530;
}
.brand { flex-direction: row; align-items: center; flex: 1; }
.brandmark {
  width: 4.25vw;
  height: 13.39vh;
  border-radius: 1.12vw;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
  margin-right: 1.25vw;
}
.brandglyph { color: #4fd6c3; font-size: 6.69vh; }
.brandcol { flex-direction: column; }
.brandtitle { color: #e8eef2; font-size: 6.69vh; line-height: 8.66vh; font-weight: bold; }
.brandsub { color: #8ca0ad; font-size: 3.94vh; line-height: 5.12vh; }
.topactions { flex-direction: row; }
.btnGhost { width: 11vw; height: 12.6vh; border-radius: 1.12vw; justify-content: center; align-items: center; background-color: #123a37; }
.btnSolid { width: 17.5vw; height: 14.17vh; border-radius: 1.12vw; justify-content: center; align-items: center; background-color: #4fd6c3; margin-top: 4.72vh; }
.btnTextAccent { color: #4fd6c3; font-size: 5.51vh; }
.btnTextDark { color: #0b0f14; font-size: 5.51vh; font-weight: bold; }

.hero {
  position: absolute;
  left: 2vw;
  top: 24.41vh;
  width: 96vw;
  height: 25.2vh;
  background-color: #121922;
  border-radius: 1.5vw;
  border-width: 1px;
  border-color: #263340;
  flex-direction: column;
  justify-content: center;
  padding-left: 1.75vw;
  padding-right: 1.75vw;
}
.heroTop { flex-direction: row; align-items: center; }
.heroBot { flex-direction: row; align-items: center; margin-top: 3.54vh; }
.herochip {
  color: #4fd6c3;
  font-size: 3.94vh;
  width: 7vw;
  border-width: 1px;
  border-color: #123a37;
  border-radius: 0.75vw;
  padding-top: 0.79vh;
  padding-bottom: 0.79vh;
  text-align: center;
}
.herotitle {
  color: #e8eef2;
  font-size: 5.51vh;
  margin-left: 1.25vw;
  flex: 1;
  lines: 1;
  text-overflow: ellipsis;
}
.heropct { color: #f5b85c; font-size: 4.72vh; margin-left: 1.25vw; }
.herobar {
  flex: 1;
  height: 2.36vh;
  border-radius: 0.38vw;
  background-color: #19242f;
}
.herotime { color: #8ca0ad; font-size: 3.94vh; margin-left: 1.25vw; width: 11.25vw; text-align: right; }
.herofill { height: 2.36vh; border-radius: 0.38vw; background-color: #4fd6c3; }
.wf0 { width: 0.25vw; }
.wf1 { width: 2.25vw; }
.wf2 { width: 4.5vw; }
.wf3 { width: 6.75vw; }
.wf4 { width: 9vw; }
.wf5 { width: 11.25vw; }
.wf6 { width: 13.5vw; }
.wf7 { width: 15.75vw; }
.wf8 { width: 18vw; }
.wf9 { width: 20.25vw; }
.wf10 { width: 22.5vw; }
.list {
  position: absolute;
  left: 2vw;
  top: 24.41vh;
  width: 96vw;
  height: 71.65vh;
}
.listLow { top: 52.76vh; height: 43.31vh; }
.row { flex-direction: row; align-items: center; height: 22.05vh; padding-left: 0.5vw; padding-right: 0.5vw; }
.cover {
  width: 3.75vw;
  height: 16.54vh;
  border-radius: 0.75vw;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
}
.coverglyph { color: #4fd6c3; font-size: 5.51vh; }
.rowmain { flex: 1; margin-left: 1.5vw; flex-direction: column; }
.rowtitle {
  color: #e8eef2;
  font-size: 5.91vh;
  line-height: 7.87vh;
  lines: 1;
  text-overflow: ellipsis;
}
.rowmeta { color: #8ca0ad; font-size: 4.33vh; line-height: 5.91vh; margin-top: 0.79vh; }
.more { width: 5.5vw; height: 12.6vh; align-items: center; justify-content: center; border-radius: 1vw; background-color: #121922; }
.moretext { color: #8ca0ad; font-size: 5.51vh; }
.sep { position: absolute; left: 5.75vw; bottom: 0vh; width: 90.25vw; height: 0.39vh; background-color: #1b2530; }
.listpad { height: 3.15vh; }

.empty {
  position: absolute;
  left: 0vw;
  top: 24.41vh;
  width: 100vw;
  height: 71.65vh;
  align-items: center;
  justify-content: center;
}
.emptyLow { top: 52.76vh; height: 43.31vh; }
.emptyglyph { color: #263340; font-size: 10.24vh; }
.emptytip { color: #8ca0ad; font-size: 5.12vh; margin-top: 2.36vh; }
</style>
