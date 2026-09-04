<template>
  <div class="screen">
    <!-- 顶栏 -->
    <div class="topbar">
      <div class="backbtn press" @click="goBack"><text class="backtext">〈 返回</text></div>
      <text class="pathtext">{{ scanMode ? ('全盘扫描 · 找到 ' + found.length + ' 本') : path }}</text>
      <div class="btn press" @click="toggleScan"><text class="btntext">{{ scanMode ? '返回浏览' : '扫描全盘' }}</text></div>
    </div>

    <!-- 扫描中 -->
    <div class="empty" v-if="scanning">
      <text class="emptyglyph">…</text>
      <text class="emptytip">正在扫描 /userdisk …（已找到 {{ found.length }} 本）</text>
    </div>

    <!-- 列表 -->
    <scroller class="list" show-scrollbar="false" v-if="!scanning">
      <div class="listpad" v-if="scanMode && found.length === 0">
        <text class="emptytip">没有找到 txt 小说。把小说放到笔的任意文件夹再试一次。</text>
      </div>
      <div v-for="(item, i) in items" :key="item.key" class="row press" @click="openItem(item)">
        <div class="glyphbox" :class="item.isDir ? 'gdir' : 'gtxt'">
          <text :class="item.isDir ? 'glyphtext' : 'glyphtextacc'">{{ item.isDir ? '夹' : '文' }}</text>
        </div>
        <div class="rowmain">
          <text class="rowtitle">{{ item.name }}</text>
          <text class="rowmeta">{{ item.meta }}</text>
        </div>
        <text class="chev">〉</text>
        <div class="sep" v-if="i < items.length - 1"></div>
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
const SKIP_EXT = /\.(jpg|jpeg|png|gif|bmp|webp|mp3|mp4|amr|zip|7z|tar|gz|dat|db|dmp|bin|so|log|html|py|sh)$/i
const MAX_DEPTH = 5
const MAX_FOUND = 400

function isTxt(name) {
  return /\.txt$/i.test(name)
}

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
      items: [],
      scanMode: false,
      scanning: false,
      found: [],
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
      if (this.scanMode) { this.scanMode = false; this.items = this.dirItems; return }
      if (this.path !== ROOT) {
        const up = this.path.slice(0, this.path.lastIndexOf('/')) || ROOT
        this.enter(up)
        return
      }
      this.$page.finish()
    },
    async enter(path) {
      this.path = path
      try {
        const list = await fs.listDir(path)
        list.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name, 'zh-Hans-CN')
        })
        this.dirItems = list.map(it => ({
          key: it.name,
          name: it.name,
          isDir: it.isDir,
          path: path + '/' + it.name,
          meta: it.isDir ? '文件夹' : (isTxt(it.name) ? '文本' : '文件'),
          txt: isTxt(it.name)
        }))
        this.items = this.dirItems
      } catch (e) {
        this.items = []
        this.toast('目录读取失败')
      }
    },
    openItem(item) {
      if (item.isDir) { this.enter(item.path); return }
      if (!item.txt) { this.toast('只支持 txt 文本'); return }
      this.askFile(item)
    },
    askFile(item) {
      this.sheetTarget = item
      this.sheetTitle = item.name
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
    },
    toggleScan() {
      if (this.scanMode) { this.scanMode = false; this.items = this.dirItems; return }
      this.startScan()
    },
    async startScan() {
      if (this.scanning) return
      this.scanning = true
      this.scanMode = true
      this.found = []
      const gen = ++this._scanGen
      const out = []
      const walk = async (dir, depth) => {
        if (gen !== this._scanGen || out.length >= MAX_FOUND) return
        let list = []
        try { list = await fs.listDir(dir) } catch (e) { return }
        for (const it of list) {
          if (out.length >= MAX_FOUND) return
          const p = dir + '/' + it.name
          if (it.isDir) {
            if (depth >= MAX_DEPTH) continue
            if (it.name.charAt(0) === '.' || SKIP_DIRS.indexOf(it.name) !== -1) continue
            await walk(p, depth + 1)
          } else if (isTxt(it.name) && !SKIP_EXT.test(it.name)) {
            let size = 0
            try { const info = await fs.fileInfo(p); size = info.size } catch (e) { /* 忽略 */ }
            out.push({
              key: p,
              name: it.name,
              isDir: false,
              path: p,
              meta: (dir === ROOT ? '根目录' : dir.replace(ROOT + '/', '')) + ' · ' + fmtSize(size),
              txt: true
            })
            this.found = out.slice()
          }
        }
      }
      try {
        await walk(ROOT, 0)
        // 大文件排前面
        out.sort((a, b) => a.path.localeCompare(b.path, "zh-Hans-CN"))
        this.found = out.slice()
      } finally {
        this.scanning = false
      }
      this.items = this.found
    }
  },
  mounted() {
    this.dirItems = []
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
  left: 0px;
  top: 0px;
  width: 800px;
  height: 52px;
  flex-direction: row;
  align-items: center;
  padding-left: 12px;
  padding-right: 16px;
  border-bottom-width: 1px;
  border-color: #1b2530;
}
.backbtn { width: 92px; height: 36px; justify-content: center; }
.backtext { color: #4fd6c3; font-size: 15px; }
.pathtext {
  flex: 1;
  color: #e8eef2;
  font-size: 13px;
  lines: 1;
  text-overflow: ellipsis;
  margin-left: 6px;
  margin-right: 6px;
}
.btn {
  width: 96px;
  height: 32px;
  border-radius: 9px;
  background-color: #123a37;
  align-items: center;
  justify-content: center;
}
.btntext { color: #4fd6c3; font-size: 13px; }

.list {
  position: absolute;
  left: 16px;
  top: 58px;
  width: 768px;
  height: 188px;
}
.row { flex-direction: row; align-items: center; height: 52px; padding-left: 4px; padding-right: 4px; }
.glyphbox {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
}
.gdir { background-color: #19242f; }
.gtxt { background-color: #123a37; }
.glyphtext { color: #8ca0ad; font-size: 12px; }
.glyphtextacc { color: #4fd6c3; font-size: 12px; }
.rowmain { flex: 1; margin-left: 12px; flex-direction: column; }
.rowtitle {
  color: #e8eef2;
  font-size: 15px;
  line-height: 20px;
  lines: 1;
  text-overflow: ellipsis;
}
.rowmeta { color: #8ca0ad; font-size: 11px; line-height: 15px; margin-top: 1px; }
.chev { color: #263340; font-size: 14px; }
.sep { position: absolute; left: 46px; bottom: 0px; width: 722px; height: 1px; background-color: #1b2530; }
.listpad { padding: 8px; }
.empty {
  position: absolute;
  left: 0px;
  top: 70px;
  width: 800px;
  height: 160px;
  align-items: center;
  justify-content: center;
}
.emptyglyph { color: #4fd6c3; font-size: 24px; }
.emptytip { color: #8ca0ad; font-size: 13px; margin-top: 6px; }
</style>
