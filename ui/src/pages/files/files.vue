<template>
  <div class="screen">
    <!-- 顶栏 -->
    <div class="topbar">
      <div class="backbtn press" @click="goBack"><text class="backtext">〈 返回</text></div>
      <text class="pathtext">{{ scanning ? (path + ' · 扫描中…') : (path + ' · ' + books.length + ' 本') }}</text>
    </div>

    <!-- 列表：文件夹在上，扫描到的 txt 在下 -->
    <scroller class="list" show-scrollbar="false">
      <div class="listpad" v-if="!scanning && folders.length === 0 && books.length === 0">
        <text class="emptytip">这里没有 txt 小说。去别的文件夹看看，或把小说复制进笔里。</text>
      </div>
      <div v-for="f in folders" :key="'d' + f.key" class="row press" @click="enter(f.path)">
        <div class="glyphbox gdir"><text class="glyphtext">夹</text></div>
        <div class="rowmain">
          <text class="rowtitle">{{ f.name }}</text>
          <text class="rowmeta">文件夹</text>
        </div>
        <text class="chev">〉</text>
      </div>
      <div v-for="(b, i) in books" :key="'b' + b.key" class="row press" @click="askFile(b)">
        <div class="glyphbox gtxt"><text class="glyphtextacc">文</text></div>
        <div class="rowmain">
          <text class="rowtitle">{{ b.name }}</text>
          <text class="rowmeta">{{ b.meta }}</text>
        </div>
        <text class="chev">〉</text>
        <div class="sep" v-if="i < books.length - 1 || folders.length > 0"></div>
      </div>
      <div class="listpad"></div>
    </scroller>

    <action-sheet :open="sheetOpen" :title="sheetTitle" :actions="sheetActions" @action="onSheetAction"></action-sheet>
    <app-toast></app-toast>
  </div>
</template>

<script>
import fs from '../../utils/pen-fs.js'
import * as lib from '../../utils/library.js'
import actionSheet from '../../components/action-sheet.vue'
import appToast from '../../components/app-toast.vue'

const ROOT = '/userdisk'
// 系统目录与巨型媒体目录，扫描时跳过
const SKIP_DIRS = ['miniapp', 'lost+found', 'pstore', 'database', 'corefile', 'swap',
  'record', 'Music', 'Videos', 'Pictures', 'Video', 'browser', 'mcserver', 'tailscale',
  'cloudbrowser-update', 'adb_persist', 'uresource', 'opt', 'Favorite']
const MAX_DEPTH = 4
const MAX_FOUND = 200

function fmtSize(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  if (n >= 1024) return Math.round(n / 1024) + ' KB'
  return n + ' B'
}

export default {
  components: { 'action-sheet': actionSheet, 'app-toast': appToast },
  data() {
    return {
      path: ROOT,
      folders: [],
      books: [],
      scanning: false,
      sheetOpen: false,
      sheetTitle: '',
      sheetActions: [],
      sheetTarget: null
    }
  },
  methods: {
    toast(text) {
      $falcon.trigger('shuge-toast', { text })
    },
    goBack() {
      if (this.path !== ROOT) {
        this.enter(this.path.slice(0, this.path.lastIndexOf('/')) || ROOT)
        return
      }
      this.$page.finish()
    },
    // 进入目录：列一级子目录 + 自动递归扫描该目录下的 txt
    async enter(path) {
      this.path = path
      const gen = ++this._scanGen
      this.scanning = true
      this.books = []
      this.folders = []
      let dirs = []
      try {
        const list = await fs.listDir(path)
        dirs = list.filter(it => it.isDir && it.name.charAt(0) !== '.' && SKIP_DIRS.indexOf(it.name) === -1)
      } catch (e) {
        this.scanning = false
        this.toast('目录读取失败')
        return
      }
      if (gen !== this._scanGen) return
      dirs.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      this.folders = dirs.map(it => ({ key: it.name, name: it.name, path: path + '/' + it.name }))
      // 递归扫描 txt（限深限量，找到即增量刷新）
      const out = []
      const base = path
      const walk = async (dir, depth) => {
        if (gen !== this._scanGen || out.length >= MAX_FOUND) return
        let list = []
        try { list = await fs.listDir(dir) } catch (e) { return }
        for (const it of list) {
          if (gen !== this._scanGen || out.length >= MAX_FOUND) return
          const p = dir + '/' + it.name
          if (it.isDir) {
            if (depth >= MAX_DEPTH) continue
            if (it.name.charAt(0) === '.' || SKIP_DIRS.indexOf(it.name) !== -1) continue
            await walk(p, depth + 1)
          } else if (/\.txt$/i.test(it.name)) {
            let size = 0
            try { const info = await fs.fileInfo(p); size = info.size } catch (e) { /* 忽略 */ }
            out.push({
              key: p,
              name: it.name,
              path: p,
              meta: (dir === base ? '' : dir.replace(base + '/', '') + ' · ') + fmtSize(size),
            })
            this.books = out.slice()
          }
        }
      }
      try {
        await walk(path, 0)
      } finally {
        if (gen === this._scanGen) {
          this.books = out.slice()
          this.scanning = false
        }
      }
    },
    askFile(b) {
      this.sheetTarget = b
      this.sheetTitle = b.name
      this.sheetActions = [
        { label: '加入书架', key: 'add' },
        { label: '直接阅读', key: 'open' }
      ]
      this.sheetOpen = true
    },
    async onSheetAction(key) {
      const target = this.sheetTarget
      this.sheetOpen = false
      if (!key || !target) return
      if (key === 'add') {
        const r = await lib.addToShelf(target.path)
        this.toast(r.added ? '已加入书架' : '已在书架中')
      }
      if (key === 'open') {
        await lib.addToShelf(target.path)
        $falcon.navTo('reader', { id: lib.bookId(target.path), path: target.path })
      }
    }
  },
  mounted() {
    this._scanGen = 0
    this.enter(ROOT)
  },
  onShow() {},
  onHide() {},
  onUnload() {
    this._scanGen++
  }
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
  padding-left: 1.5vw;
  padding-right: 2vw;
  border-bottom-width: 1px;
  border-color: #1b2530;
}
.backbtn { width: 11.5vw; height: 14.17vh; justify-content: center; }
.backtext { color: #4fd6c3; font-size: 5.91vh; }
.pathtext {
  flex: 1;
  color: #e8eef2;
  font-size: 5.12vh;
  lines: 1;
  text-overflow: ellipsis;
  margin-left: 0.75vw;
}

.list {
  position: absolute;
  left: 2vw;
  top: 22.83vh;
  width: 96vw;
  height: 74.02vh;
}
.row { flex-direction: row; align-items: center; height: 20.47vh; padding-left: 0.5vw; padding-right: 0.5vw; }
.glyphbox {
  width: 3.75vw;
  height: 11.81vh;
  border-radius: 1vw;
  align-items: center;
  justify-content: center;
}
.gdir { background-color: #19242f; }
.gtxt { background-color: #123a37; }
.glyphtext { color: #8ca0ad; font-size: 4.72vh; }
.glyphtextacc { color: #4fd6c3; font-size: 4.72vh; }
.rowmain { flex: 1; margin-left: 1.5vw; flex-direction: column; }
.rowtitle {
  color: #e8eef2;
  font-size: 5.91vh;
  line-height: 7.87vh;
  lines: 1;
  text-overflow: ellipsis;
}
.rowmeta { color: #8ca0ad; font-size: 4.33vh; line-height: 5.91vh; margin-top: 0.39vh; }
.chev { color: #263340; font-size: 5.51vh; }
.sep { position: absolute; left: 5.75vw; bottom: 0vh; width: 90.25vw; height: 0.39vh; background-color: #1b2530; }
.listpad { padding: 1vw; }
.emptytip { color: #8ca0ad; font-size: 5.12vh; }
</style>
