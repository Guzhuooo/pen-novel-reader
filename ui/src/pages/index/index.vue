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
      <text class="herolabel">继续阅读</text>
      <text class="herotitle">{{ lastBook.title }}</text>
      <div class="herobar"><text class="herofill" :class="'wf' + heroStep"> </text></div>
      <text class="heropct">{{ heroPercent }} · {{ lastWhen }}</text>
      <text class="herogo">阅读 〉</text>
    </div>

    <!-- 书架列表 -->
    <scroller class="list" show-scrollbar="false" v-if="books.length > 0">
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
    <div class="empty" v-if="books.length === 0">
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
  left: 0px;
  top: 0px;
  width: 800px;
  height: 52px;
  flex-direction: row;
  align-items: center;
  padding-left: 16px;
  padding-right: 16px;
  border-bottom-width: 1px;
  border-color: #1b2530;
}
.brand { flex-direction: row; align-items: center; flex: 1; }
.brandmark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}
.brandglyph { color: #4fd6c3; font-size: 17px; }
.brandcol { flex-direction: column; }
.brandtitle { color: #e8eef2; font-size: 17px; line-height: 22px; font-weight: bold; }
.brandsub { color: #8ca0ad; font-size: 10px; line-height: 13px; }
.topactions { flex-direction: row; }
.btnGhost { width: 88px; height: 32px; border-radius: 9px; justify-content: center; align-items: center; background-color: #123a37; }
.btnSolid { width: 140px; height: 36px; border-radius: 9px; justify-content: center; align-items: center; background-color: #4fd6c3; margin-top: 12px; }
.btnTextAccent { color: #4fd6c3; font-size: 14px; }
.btnTextDark { color: #0b0f14; font-size: 14px; font-weight: bold; }

.hero {
  position: absolute;
  left: 16px;
  top: 62px;
  width: 768px;
  height: 64px;
  background-color: #121922;
  border-radius: 12px;
  border-width: 1px;
  border-color: #263340;
  flex-direction: row;
  align-items: center;
  padding-left: 14px;
  padding-right: 14px;
}
.herolabel {
  color: #4fd6c3;
  font-size: 11px;
  width: 64px;
  border-width: 1px;
  border-color: #123a37;
  border-radius: 6px;
  padding: 3px 0px;
  text-align: center;
}
.herotitle {
  color: #e8eef2;
  font-size: 16px;
  margin-left: 12px;
  width: 300px;
  lines: 1;
  text-overflow: ellipsis;
}
.herobar {
  width: 180px;
  height: 6px;
  border-radius: 3px;
  background-color: #19242f;
  margin-left: 14px;
}
.herofill { height: 6px; border-radius: 3px; background-color: #4fd6c3; }
.wf0 { width: 2px; }
.wf1 { width: 18px; }
.wf2 { width: 36px; }
.wf3 { width: 54px; }
.wf4 { width: 72px; }
.wf5 { width: 90px; }
.wf6 { width: 108px; }
.wf7 { width: 126px; }
.wf8 { width: 144px; }
.wf9 { width: 162px; }
.wf10 { width: 180px; }
.heropct { color: #8ca0ad; font-size: 11px; margin-left: 14px; flex: 1; }
.herogo { color: #f5b85c; font-size: 13px; }

.list {
  position: absolute;
  left: 16px;
  top: 62px;
  width: 768px;
  height: 182px;
}
.row { flex-direction: row; align-items: center; height: 56px; padding-left: 4px; padding-right: 4px; }
.cover {
  width: 30px;
  height: 42px;
  border-radius: 6px;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
}
.coverglyph { color: #4fd6c3; font-size: 14px; }
.rowmain { flex: 1; margin-left: 12px; flex-direction: column; }
.rowtitle {
  color: #e8eef2;
  font-size: 15px;
  line-height: 20px;
  lines: 1;
  text-overflow: ellipsis;
}
.rowmeta { color: #8ca0ad; font-size: 11px; line-height: 15px; margin-top: 2px; }
.more { width: 44px; height: 32px; align-items: center; justify-content: center; border-radius: 8px; background-color: #121922; }
.moretext { color: #8ca0ad; font-size: 14px; }
.sep { position: absolute; left: 46px; bottom: 0px; width: 722px; height: 1px; background-color: #1b2530; }
.listpad { height: 8px; }

.empty {
  position: absolute;
  left: 0px;
  top: 62px;
  width: 800px;
  height: 182px;
  align-items: center;
  justify-content: center;
}
.emptyglyph { color: #263340; font-size: 26px; }
.emptytip { color: #8ca0ad; font-size: 13px; margin-top: 6px; }
</style>
