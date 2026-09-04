# 书阁 · 有道词典笔小说阅读器

一款运行在有道词典笔（Falcon / HaaS UI mini-app 运行时）上的**暗色小说阅读器**。
纯离线：直接读取笔内存储的 txt 小说，支持书架、全盘扫描、书签、进度记忆与两种翻页方式。

![appid](https://img.shields.io/badge/appid-8001876543210987-4fd6c3)
![runtime](https://img.shields.io/badge/runtime-Falcon%20%2F%20Vue2.6-121922)

## 功能

- **书架**：保存到笔里的小说集中管理，顶部「继续阅读」一键回到上次位置
- **找小说**：进入任意目录**自动递归扫描**其中的 txt（文件夹在上、书在下）
- **阅读器**：暗色护眼，点击非翻页区域从左侧呼出**侧边栏设置**
- **字号** 18–26、**背景主题** 6 套（曜石/墨蓝/暗森/羊皮/纯黑/米白）
- **阅读方式**：`滑动`（左右滑翻页，点按呼出侧边栏）或 `点击`（点屏幕左右 1/4 翻页、
  中间呼出侧边栏，两侧保留翻页键），随时切换
- **书签**：任意页一键加书签，侧边栏内跳转/删除
- **进度记忆**：按字符偏移保存，改字号也不会丢位置；退出即存，重进即恢复
- **大书友好**：增量排版——12MB / 27292 页实测打开约 1 秒即可阅读，
  标题栏显示「排版中 N%」，后台约 15 秒排完，未排到的区域翻页会友好提示

## 真机适配记录（profile 摘要）

| 项目 | 值 |
|---|---|
| 设备 | 有道词典笔（CoCo-1826，Cvitek cv182x，ARMv7 glibc Buildroot） |
| 逻辑屏幕 | 800×254 横屏（fb 原生 254×800，`direction: 270`） |
| 文件读取 | 原生模块 `custom.scan`：`listDir / readText / fileInfo / exists / mkdirs / removeFile / rmdir` |
| 存储 | `$falcon.jsapi.storage`：`setStorage({key,data})` / `getStorage({key}) -> {data}` |
| 启动 | `miniapp_cli install <amr>` 后 `miniapp_cli start <appid>`（**不带 `--page`**，本固件该写法解析不了页面名） |
| 入口 | 运行时要求 qjsc 编译产物（`aiot-cli -c -q -p`），每个页面独立 chunk |

详细画像与验证证据见 [profiles/youdao-dictpen-coco1826.md](profiles/youdao-dictpen-coco1826.md)。

## 通用自适应（v1.2.0 起）

- **布局**：全部页面按 800×254 设计稿以 `vw/vh` 单位编写，宽度随屏宽、高度随屏高等比拉伸。
- **分页版式**：启动时从设备运行时配置 `/etc/miniapp/resources/cfg.json` 读取逻辑分辨率
  （90/270 度自动换向），按比例推导每页行数与字数；读不到时回退 800×254。
  即同一个 AMR 可以在不同分辨率的词典笔上正常分页排版。
- **运行环境要求**：Falcon/QuickJS 运行时 + ARMv7 glibc（包内 `custom.scan` 原生模块为该 ABI；
  其他 ABI 的笔会因原生模块加载失败而无法读文件）。

## 已知限制

- **编码**：设备端 `readText` 按 UTF-8 转码，GBK 文件的字节会被替换为 `U+FFFD`（有损）。
  本应用会检测到并提示；请把 GBK 小说先转成 UTF-8 再放进笔里。
- **横竖屏**：固件不支持应用内旋转屏幕（运行时 `cfg.json` 固定 `direction: 270`），
  CSS transform 旋转容器内的文字不渲染（真机实测），故本应用为横屏版式。
- **触屏注入**：无法通过 adb 注入触摸事件做自动化，交互请在真机上验证。
- **大书**：12MB/500 万字实测可读（增量排版）；更大书籍未测。

## 本地构建

环境：Node.js 18+、pnpm 10.12.4

```bash
pnpm install
pnpm test          # 纯逻辑单元测试（分页器/文本处理）
pnpm build         # 生成 ui/8001876543210987.1_0_0.amr
```

安装到笔：

```bash
adb push ui/8001876543210987.1_0_0.amr /tmp/app.amr
adb shell miniapp_cli install /tmp/app.amr
adb shell miniapp_cli start 8001876543210987
```

## GitHub Actions

推送即自动构建，AMR 在 Actions Artifacts 里下载：[.github/workflows/build.yml](.github/workflows/build.yml)。

## 目录结构

```text
aiot-vue-cli/   # Falcon 构建器（vendored，MIT）
ui/             # 主应用（书阁）
  libs/         # 原生 jsapi（libjsapi_langningchen.so，提供 custom.scan 文件能力）
  src/
    pages/      # index 书架 / files 找小说 / reader 阅读器
    utils/      # pen-fs、kvstore、library、paginator、coords、text（纯逻辑可单测）
probe/          # jsapi 探针小应用（开发期真机 API 验证工具）
tools/          # 触摸注入等调试脚本
test/           # node --test 单元测试
```

## 许可

GPL-3.0-or-later。构建器 `aiot-vue-cli` 为 MIT 许可，保持其原始声明。
