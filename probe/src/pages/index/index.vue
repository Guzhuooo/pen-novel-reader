<template>
  <div class="screen">
    <scroller class="log" show-scrollbar="true">
      <text class="line" v-for="(l, i) in lines" :key="i">{{ l }}</text>
    </scroller>
    <div class="rotzone">
      <text class="normtext">未旋转对照 Normal 123</text>
      <div class="rotstage">
        <text class="rottextA">A旋转容器内静态文本 StaticText 123</text>
      </div>
      <text class="rottextB">B自身旋转 RotatedSelf 123</text>
      <canvas ref="cv" class="cvs" ></canvas>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return { lines: ['probe done marker'] }
  },
  methods: {
    log(s) {
      this.lines.unshift(String(s))
    },
    hex(s, n) {
      const out = []
      for (let i = 0; i < Math.min(n, s.length); i++) {
        out.push(s.charCodeAt(i).toString(16))
      }
      return out.join(',')
    },
    async run() {
      try {
        const jsapi = $falcon.jsapi || {}
        this.log('jsapi keys: ' + Object.keys(jsapi).join(','))
        for (const k of Object.keys(jsapi)) {
          try {
            const v = jsapi[k]
            if (v && typeof v === 'object') {
              this.log('  ' + k + ': ' + Object.keys(v).filter(x => typeof v[x] === 'function').join(','))
            } else {
              this.log('  ' + k + ': ' + typeof v)
            }
          } catch (e) { this.log('  ' + k + ' err') }
        }
      } catch (e) { this.log('jsapi err ' + e) }
      try {
        this.log('env: ' + JSON.stringify($falcon.env || {}))
      } catch (e) { this.log('env err') }
      try {
        this.log('workspace: ' + JSON.stringify(typeof globalThis.$workspace !== 'undefined' ? globalThis.$workspace : 'undef'))
      } catch (e) { this.log('workspace err') }
      try {
        const st = $falcon.jsapi && $falcon.jsapi.storage
        if (st) {
          const t = async (name, fn) => {
            try { this.log(name + ': ' + JSON.stringify(await fn()).slice(0, 120)) } catch (e) { this.log(name + ' threw ' + e) }
          }
          await t('A set value/get', async () => { await st.setStorage({ key: 'p1', value: 'v1' }); return st.getStorage({ key: 'p1' }) })
          await t('B set data/get', async () => { await st.setStorage({ key: 'p2', data: 'v2' }); return st.getStorage({ key: 'p2' }) })
        } else {
          this.log('storage: MISSING')
        }
      } catch (e) { this.log('storage err ' + e) }
      try {
        const mod = await import('custom')
        const c = mod.default || mod
        await (async () => {
          this.log('custom keys: ' + JSON.stringify(Object.keys(c)))
          if (!c.scan) return
          this.log('scan methods: ' + Object.keys(c.scan).filter(k => typeof c.scan[k] === 'function').join(','))
          for (const m of ['listDir', 'fileInfo', 'exists', 'readText', 'readFile']) {
            if (typeof c.scan[m] === 'function') {
              try {
                const r = await c.scan[m]('/userdisk/novel_probe_utf8.txt')
                this.log('scan.' + m + ' -> ' + JSON.stringify(r).slice(0, 160))
              } catch (e) { this.log('scan.' + m + ' threw ' + e) }
            }
          }
          try {
            const g = await c.scan.readText('/userdisk/novel_probe_gbk.txt')
            this.log('gbk readText len=' + g.length + ' codes: ' + this.hex(String(g), 12))
            this.log('gbk head: ' + String(g).slice(0, 8))
          } catch (e) { this.log('gbk readText err ' + e) }
          try {
            const ld = await c.scan.listDir('/userdisk')
            this.log('listDir type: ' + JSON.stringify(ld).slice(0, 160))
          } catch (e) { this.log('listDir err ' + e) }
        })()
      } catch (e) { this.log('custom import err: ' + (e && e.message ? e.message : e)) }
      try {
        const mod = await import('fs')
        this.log('fs module: ' + typeof mod + ' default=' + typeof (mod && mod.default))
        const fs = mod.default || mod
        if (fs && typeof fs.readdir === 'function') {
          const list = await fs.readdir('/userdisk')
          this.log('readdir /userdisk n=' + list.length + ' [' + list.slice(0, 6).join('|') + ']')
        }
        if (fs && typeof fs.readFile === 'function') {
          try {
            const u8 = await fs.readFile('/userdisk/novel_probe_utf8.txt')
            this.log('utf8 file str: ' + String(u8).slice(0, 12))
            this.log('utf8 charcodes: ' + this.hex(String(u8), 10))
          } catch (e) { this.log('read utf8 err: ' + e) }
          try {
            const g = await fs.readFile('/userdisk/novel_probe_gbk.txt')
            this.log('gbk file len=' + String(g).length)
            this.log('gbk charcodes: ' + this.hex(String(g), 10))
          } catch (e) { this.log('read gbk err: ' + e) }
        }
        if (fs && typeof fs.stat === 'function') {
          const info = await fs.stat('/userdisk/novel_probe_utf8.txt')
          this.log('stat size=' + info.size + ' dir=' + info.isDirectory())
        }
      } catch (e) { this.log('fs import err: ' + (e && e.message ? e.message : e)) }
      try {
        const mod = await import('custom')
        this.log('custom module: ' + JSON.stringify(Object.keys(mod.default || mod)))
      } catch (e) { this.log('custom import err: ' + (e && e.message ? e.message : e)) }
      this.log('probe done')
    }
  },
  mounted() {
    setTimeout(() => this.run(), 300)
    this.$nextTick(() => {
      try {
        const canvas = this.$refs.cv
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#4fd6c3'
        ctx.font = '20px sans-serif'
        ctx.fillText('Canvas正绘中文ABC', 10, 30)
        ctx.save()
        ctx.translate(270, 20)
        ctx.rotate(90 * Math.PI / 180)
        ctx.fillStyle = '#f5b85c'
        ctx.fillText('Canvas旋转中文竖排', 0, 0)
        ctx.restore()
        let m = '?'
        try { m = JSON.stringify(ctx.measureText('测试宽度')) } catch (e) { m = 'measure err ' + e }
        this.log('canvas measure: ' + m)
        this.log('canvas drawn ok')
      } catch (e) {
        this.log('canvas err: ' + e)
      }
    })
  },
  onShow() {},
  onHide() {},
  onUnload() {}
}
</script>

<style lang="less" scoped>
.screen {
  width: 800px;
  height: 254px;
  background-color: #0b0f14;
  flex-direction: row;
}
.log {
  width: 470px;
  height: 254px;
  padding: 6px;
}
.line {
  color: #9fe8dd;
  font-size: 13px;
  line-height: 17px;
}
.rotzone {
  width: 320px;
  height: 254px;
  position: relative;
  background-color: #131a22;
}
.normtext {
  position: absolute;
  left: 10px;
  top: 10px;
  color: #f5b85c;
  font-size: 16px;
}
.rotstage {
  position: absolute;
  left: 33px;
  top: -273px;
  width: 254px;
  height: 800px;
  background-color: #1a242e;
  transform: rotate(90deg);
  transform-origin: 127px 400px;
}
.rottextA {
  margin-left: 10px;
  margin-top: 40px;
  width: 234px;
  color: #e8eef2;
  font-size: 18px;
  line-height: 26px;
}
.rottextB {
  position: absolute;
  left: 40px;
  top: 120px;
  width: 200px;
  color: #4fd6c3;
  font-size: 18px;
  transform: rotate(90deg);
  transform-origin: 100px 13px;
}
.rotstage2 {
  display: none;
}
.rottextC {
  display: none;
}
.cvs {
  position: absolute;
  left: 0px;
  top: 60px;
  width: 300px;
  height: 180px;
  background-color: #101820;
}
</style>
