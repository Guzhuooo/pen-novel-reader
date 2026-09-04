<template>
  <div class="mask" v-if="open" @click="cancel">
    <div class="sheet" @click="noop">
      <text class="sheettitle">{{ title }}</text>
      <scroller class="sheetlist" show-scrollbar="false">
        <div v-for="(act, i) in actions" :key="i" class="srow press" @click="pick(i)">
          <text class="srowtext" :class="act.danger ? 'srowdanger' : 'srownormal'">{{ act.label }}</text>
        </div>
        <div class="srow press" @click="cancel">
          <text class="srowtext srowcancel">取消</text>
        </div>
      </scroller>
    </div>
  </div>
</template>
<script>
export default {
  props: {
    open: { default: false },
    title: { default: '' },
    actions: { default: () => [] } // [{label, danger, key}]
  },
  methods: {
    pick(i) {
      this.$emit('action', this.actions[i] ? this.actions[i].key : null)
    },
    cancel() {
      this.$emit('action', null)
    },
    noop() { /* 阻断冒泡到 mask */ }
  }
}
</script>
<style lang="less" scoped>
@import "../styles/common.less";
.mask {
  position: fixed;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 254px;
  background-color: rgba(5, 8, 12, 0.72);
  z-index: 90;
}
.sheet {
  position: absolute;
  left: 490px;
  top: 14px;
  width: 290px;
  height: 226px;
  background-color: #19242f;
  border-radius: 12px;
  border-width: 1px;
  border-color: #263340;
  padding: 12px;
}
.sheettitle {
  color: #8ca0ad;
  font-size: 12px;
  line-height: 18px;
  margin-bottom: 4px;
}
.sheetlist {
  width: 266px;
  height: 180px;
}
.srow {
  height: 38px;
  border-radius: 8px;
  justify-content: center;
  margin-top: 4px;
  background-color: #121922;
}
.srowtext {
  font-size: 15px;
  line-height: 20px;
  text-align: center;
}
.srownormal { color: #e8eef2; }
.srowdanger { color: #ff6b72; }
.srowcancel { color: #8ca0ad; }
</style>
