#!/usr/bin/env bash
# 书阁原生模块（fs jsapi）交叉编译脚本
# 自动识别本机的交叉工具链 -> 编译 libjsapi_shuge.so -> ELF 校验 -> 可选安装/上传。
#
# 用法:
#   tools/build-native.sh --list                 # 列出识别到的工具链
#   tools/build-native.sh                        # 自动选择最优工具链并编译
#   tools/build-native.sh --prefix arm-linux-gnueabihf-
#   tools/build-native.sh --abi armv7-glibc --install     # 编译并装入 ui/libs（随 AMR 打包）
#   tools/build-native.sh --upload                        # 编译并上传到 GitHub Release
#
# 环境变量: CROSS_TOOLCHAIN_PREFIX 可代替 --prefix；GITHUB_TOKEN 用于 --upload。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/native/jsapi/src"
INC="$ROOT/native/jsapi/iot-miniapp-sdk/include"
MODULE=libjsapi_shuge.so

LIST=0; INSTALL=0; UPLOAD=0; PREFIX="${CROSS_TOOLCHAIN_PREFIX:-}"; ABI=""

while [ $# -gt 0 ]; do
  case "$1" in
    --list) LIST=1 ;;
    --install) INSTALL=1 ;;
    --upload) UPLOAD=1 ;;
    --prefix) PREFIX="$2"; shift ;;
    --abi) ABI="$2"; shift ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
  shift
done

# ---------- 工具链识别 ----------
# 候选三元组，顺序即优先级（第一优先是这支笔验证过的 armv7 glibc 硬浮点）
TRIPLES="arm-buildroot-linux-gnueabihf arm-linux-gnueabihf arm-none-linux-gnueabihf arm-none-linux-gnueabi aarch64-linux-gnu arm-linux-musleabihf aarch64-linux-musl"

derive_abi() { # $1=triple -> ABI 名
  case "$1" in
    *aarch64*musl*) echo "aarch64-musl" ;;
    *aarch64*) echo "aarch64-glibc" ;;
    *musleabihf*) echo "armv7-musl" ;;
    *gnueabihf*|*armhf*) echo "armv7-glibc" ;;
    *gnueabi*) echo "arm-softfp-glibc" ;;
    *) echo "unknown" ;;
  esac
}

SEARCH_DIRS="$PATH"
for extra in /usr/bin /usr/local/bin /opt/*/bin "$HOME"/x-tools/*/bin "$HOME"/.local/bin; do
  [ -d "$extra" ] && SEARCH_DIRS="$SEARCH_DIRS:$extra"
done

detect_all() {
  for d in ${SEARCH_DIRS//:/ }; do
    for t in $TRIPLES; do
      if [ -x "$d/${t}g++" ]; then echo "$t|$d/${t}"; fi
    done
  done | sort -u
}

if [ "$LIST" = 1 ]; then
  echo "识别到的交叉工具链（按优先级）:"
  found=$(detect_all || true)
  if [ -z "$found" ]; then
    echo "  （没有找到。Ubuntu/Debian 可装: sudo apt install g++-arm-linux-gnueabihf g++-aarch64-linux-gnu）"
    exit 1
  fi
  while IFS='|' read -r t path; do echo "  $(derive_abi "$t")  <-  $path"; done <<< "$found"
  exit 0
fi

# 选定前缀
if [ -z "$PREFIX" ]; then
  first=$(detect_all | head -n 1 || true)
  if [ -z "$first" ]; then
    echo "错误: 未找到交叉工具链。Ubuntu/Debian 安装:" >&2
    echo "  sudo apt install g++-arm-linux-gnueabihf   # 本笔验证过的 ABI (armv7-glibc)" >&2
    echo "  sudo apt install g++-aarch64-linux-gnu     # 64 位笔" >&2
    echo "或用 --prefix 指定 buildroot 工具链（如 arm-buildroot-linux-gnueabihf-）" >&2
    exit 1
  fi
  bin="$(basename "${first#*|}")"   # 例: arm-linux-gnueabihf-g++
  PREFIX="${bin%g++}-"              # 例: arm-linux-gnueabihf-
fi
TRIPLE="${PREFIX%-}"
ABI="${ABI:-$(derive_abi "$TRIPLE")}"
CXX="${PREFIX}g++"
CC="${PREFIX}gcc"
READELF="${PREFIX}readelf"
NM="${PREFIX}nm"

command -v "$CXX" >/dev/null 2>&1 || { echo "错误: 找不到 $CXX" >&2; exit 1; }
command -v "$READELF" >/dev/null 2>&1 || READELF=readelf
command -v "$NM" >/dev/null 2>&1 || NM=nm

OUT_DIR="$ROOT/dist/native/${ABI}"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/$MODULE"

echo "== 工具链: $CXX  (ABI: $ABI) =="
SYSROOT=$("$CXX" -print-sysroot 2>/dev/null || true)
[ -n "$SYSROOT" ] && echo "== sysroot: $SYSROOT =="

# ---------- 编译 ----------
echo "== 编译 $MODULE =="
"$CXX" -shared -fPIC -std=c++11 -O2 -fvisibility=hidden \
  -I"$SRC" -I"$INC" \
  "$SRC/JSAPI.cpp" "$SRC/FileSystem.cpp" \
  -o "$OUT"
echo "== 输出: $OUT ($(du -h "$OUT" | cut -f1)) =="

# ---------- ELF 校验 ----------
fail=0
MACHINE=$("$READELF" -h "$OUT" | awk '/Machine:/{print $NF}')
case "$TRIPLE" in
  *aarch64*) EXPECTED=AArch64 ;;
  *) EXPECTED=ARM ;;
esac
if [ "$MACHINE" != "$EXPECTED" ]; then
  echo "校验失败: 期望 $EXPECTED 得到 $MACHINE"
  fail=1
fi
if ! "$NM" -D "$OUT" 2>/dev/null | grep -q custom_init_jsapis; then
  echo "校验失败: 未导出 custom_init_jsapis"; fail=1
fi
NEEDED=$("$READELF" -d "$OUT" | grep NEEDED | awk '{print $NF}' | tr -d '[]' | tr '\n' ' ' || true)
echo "== NEEDED: $NEEDED =="
for lib in $NEEDED; do
  case "$lib" in
    libc.so*|libstdc++.so*|libgcc_s.so*|libm.so*|libdl.so*) ;;
    *) echo "警告: 依赖了非基础库 $lib（目标笔可能没有）"; ;;
  esac
done
[ "$fail" = 0 ] || { echo "ELF 校验未通过"; exit 1; }
echo "== ELF 校验通过 =="

SHA=$(sha256sum "$OUT" | cut -d' ' -f1)
echo "== SHA256: $SHA =="

# ---------- 安装 ----------
if [ "$INSTALL" = 1 ]; then
  cp "$OUT" "$ROOT/ui/libs/$MODULE"
  echo "== 已装入 ui/libs/$MODULE（下次 pnpm -C ui package 随 AMR 打包）=="
  echo "注意: 该模块只注册 fs；笔上原生的 custom.scan 由 ui/libs/libjsapi_langningchen.so 提供，两者可共存。"
fi

# ---------- 上传 ----------
if [ "$UPLOAD" = 1 ]; then
  TOKEN="${GITHUB_TOKEN:-}"
  if [ -z "$TOKEN" ] && command -v git >/dev/null 2>&1; then
    TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2 || true)
  fi
  [ -n "$TOKEN" ] || { echo "错误: --upload 需要 GITHUB_TOKEN 或已存的 git 凭据" >&2; exit 1; }
  REPO="${GITHUB_REPOSITORY:-Guzhuooo/pen-novel-reader}"
  TAG="native-$ABI"
  api() { curl -sf -H "Authorization: token $TOKEN" -H "User-Agent: build-native" "$@"; }
  REL_ID=$(api "https://api.github.com/repos/$REPO/releases/tags/$TAG" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*' || true)
  if [ -z "$REL_ID" ]; then
    REL_ID=$(api -X POST -d "{\"tag_name\":\"$TAG\",\"name\":\"native $ABI\",\"body\":\"自动交叉编译的 $MODULE ($ABI), SHA256 $SHA\",\"draft\":false,\"prerelease\":false}" \
      "https://api.github.com/repos/$REPO/releases" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
    echo "== 已创建 Release $TAG =="
  fi
  for i in 1 2 3; do
    if api -X POST -H "Content-Type: application/octet-stream" --data-binary @"$OUT" \
      "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=$MODULE.$ABI.so" >/dev/null; then
      echo "== 已上传: https://github.com/$REPO/releases/tag/$TAG =="
      break
    fi
    echo "上传重试 $i/3..."; sleep 5
  done
fi

echo "== 完成 =="
