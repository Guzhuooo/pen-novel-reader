# 设备画像：有道词典笔（CoCo-1826）

```yaml
profile_id: youdao-dictpen-coco1826-3.4.6
model: "YoudaoDictionaryPen-112 (CoCo-1826, Cvitek cv182x)"
firmware: "miniapp runtime 3.4.6, kernel 4.19.164-tag--g23c8a94c91bf (2026-03-30)"
runtime:
  falcon: "jsfm-nvue (QuickJS 字节码加载)"
  vue: "2.6.12 (weex-template-compiler 2.6.12-falcon3 编译)"
  quickjs: "20200705"
  debugger: true
abi:
  machine: "armv7l (ARMv7-A, Cortex-A53, neon vfpv4)"
  bits: 32
  libc: "glibc (Buildroot 2021.05-rc3)"
  toolchain: "arm-buildroot-linux-gnueabihf (native jsapi)"
screen:
  physical: { width: 254, height: 800, direction: 270, xoffset: 0, yoffset: 0 }
  touch: { direction: 270, xoffset: 113, yoffset: 0, node: "/dev/input/event4" }
  design: { width: 800, height: 254 }  # 应用按横屏 800×254 固定像素布局
input_method:
  version: "有道输入法 8001666679481944 (system app)"
  global_text_edit: untested
  textarea_soft_input: untested
jsapi:
  storage:
    set: "storage.setStorage({key, data})  # 参数名是 data，不是 value"
    get: "storage.getStorage({key}) -> {data}"
    note: "getStorageInfo 在本固件返回 {error:3}; 另有 get/setGlobalStorage 变体"
  file: "原生模块 custom (libs/libjsapi_langningchen.so): scan.{listDir, readText, fileInfo, exists, mkdirs, removeFile, rmdir, dataDir}, jm.{...漫画下载}"
  fs_module: "不存在（'could not load module fs'）——预编译 so 是旧版，未注册 fs 模块"
  encoding: "readText 按 UTF-8 转码；GBK 字节 -> U+FFFD（有损）"
  listDir: "scan.listDir(dir) -> [{name, isDir}]（目录之外返回 null）"
package:
  appid: "8001876543210987"
  start_page: "index"
  install_dir: "/userdisk/miniapp/data/mini_app/pkg/<appid>/{a|b}/"
  data_dir: "/userdisk/miniapp/data/mini_app/pkg/<appid>/data/"
startup:
  install: "miniapp_cli install /tmp/<app>.amr"
  start: "miniapp_cli start <appid>   # 裸启动；'start <appid> --<page>' 会报 app parameter not right / could not load module '--<page>.js'"
  build: "必须 qjsc (-c -q -p)：运行时加载 .js.bin；产物需每页独立 chunk（单页面会被打进 app.js 导致页面类缺失）"
validation:
  tested_at: "2026-09-04"
  evidence:
    - "探针 app（8001999900000001）枚举 jsapi 并验证 storage/readText/listDir/fileInfo 契约（截图+日志）"
    - "阅读器真机渲染：61 页测试书、页码/进度/翻页键正常（captureFB 截图）"
    - "书架空态页渲染正常（captureFB 截图）"
    - "纯逻辑单元测试 node --test 7/7 通过"
  unverified:
    - "触摸交互（adb 无法注入触摸，需真机手动验证翻页/菜单/书签）"
    - "系统输入法两条路径（本应用未用到文本输入）"
    - "transform rotate 对 text 元素可渲染（探针已证），对容器内文字不渲染（探针已证）"
  quirks:
    - "capture/captureFB 截帧可能取到旧缓冲，需隔帧重拍"
    - "覆盖安装后首次 start 可能读到旧实例，需重新 start"
```
