// 设备文件系统适配层（跨机型）。
// 优先级：
//   1) 原生模块 custom（libjsapi_langningchen.so，armv7-glibc 笔）：custom.scan.*，
//      readText 由原生做 UTF-8 转码（探针验证）；GBK 字节会变 U+FFFD（有损）。
//   2) 原生模块 fs（libjsapi_shuge.so，各 ABI 均可由 tools/build-all-releases.sh 编译）：
//      fs.{listDir... 无 -> readdir/stat/readFile/exists}，readFile 按 UTF-8 解释。
//   3) jsapi.scan（部分固件内置）。
// 注意：custom 与 fs 都必须是动态 import——静态 import 在模块缺失时会让整个
// 模块链求值失败（页面白屏），动态 import 的异常可以捕获后走兜底。
let fsModuleState = undefined // undefined=未探测, false=不可用, 否则为模块对象
let customState = undefined

async function customModule() {
  if (customState !== undefined) return customState
  try {
    const m = await import('custom')
    customState = (m && (m.default || m)) || null
  } catch (e) {
    customState = null
  }
  return customState
}

async function fsApi() {
  if (fsModuleState !== undefined) return fsModuleState || null
  try {
    const m = await import('fs')
    const mod = m && (m.default || m)
    if (mod && typeof mod.readFile === 'function') {
      fsModuleState = mod
      return mod
    }
  } catch (e) { /* 模块不存在 */ }
  fsModuleState = false
  return null
}

async function scanApi() {
  const c = await customModule()
  if (c && c.scan) return c.scan
  try {
    const jsapi = $falcon && $falcon.jsapi
    if (jsapi && jsapi.scan) return jsapi.scan
  } catch (e) { /* 无 scan jsapi */ }
  return null
}

function unwrap(result) {
  if (result && typeof result === 'object' && 'result' in result) return result.result
  return result
}

export async function listDir(path) {
  const scan = await scanApi()
  if (!scan || typeof scan.listDir !== 'function') throw new Error('scan api unavailable')
  const raw = unwrap(await scan.listDir(String(path)))
  if (Array.isArray(raw)) {
    return raw
      .filter(item => item && item.name != null && item.name !== '.' && item.name !== '..')
      .map(item => ({
        name: String(item.name),
        isDir: !!(typeof item.isDirectory === 'function' ? item.isDirectory() : item.isDir),
      }))
  }
  return []
}

export async function readText(path) {
  const scan = await scanApi()
  if (!scan || typeof scan.readText !== 'function') throw new Error('readText api unavailable')
  const raw = unwrap(await scan.readText(String(path)))
  if (typeof raw !== 'string' || raw === '') throw new Error('cannot read text: ' + path)
  return raw
}

export async function exists(path) {
  const scan = await scanApi()
  if (!scan || typeof scan.exists !== 'function') return false
  const raw = unwrap(await scan.exists(String(path)))
  return raw === true || (raw && typeof raw === 'object' && raw.exists === true)
}

export async function fileInfo(path) {
  const scan = await scanApi()
  if (!scan || typeof scan.fileInfo !== 'function') throw new Error('fileInfo api unavailable')
  const raw = unwrap(await scan.fileInfo(String(path)))
  const info = raw && raw.data ? raw.data : raw
  if (!info || info.exists === false) throw new Error('not found: ' + path)
  return {
    size: Number(info.size || 0),
    isDir: !!info.isDir,
    mtime: Number(info.mtime || 0),
  }
}

export default { listDir, readText, exists, fileInfo }
