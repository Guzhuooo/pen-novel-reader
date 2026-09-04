// 设备文件系统适配层。
// 本固件的文件能力来自原生模块 custom（libjsapi_langningchen.so）：
//   custom.scan.{listDir, readText, exists, fileInfo, mkdirs, removeFile, rmdir, dataDir}
// 已在真机探针验证：readText 对 UTF-8 文本正确转码；GBK 字节会被替换为 U+FFFD（有损）。
import custom from 'custom'

function scanApi() {
  try {
    if (custom && custom.scan) return custom.scan
  } catch (e) { /* 模块缺失 */ }
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
  const scan = scanApi()
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
  const scan = scanApi()
  if (!scan || typeof scan.readText !== 'function') throw new Error('readText api unavailable')
  const raw = unwrap(await scan.readText(String(path)))
  if (typeof raw !== 'string' || raw === '') throw new Error('cannot read text: ' + path)
  return raw
}

export async function exists(path) {
  const scan = scanApi()
  if (!scan || typeof scan.exists !== 'function') return false
  const raw = unwrap(await scan.exists(String(path)))
  return raw === true || (raw && typeof raw === 'object' && raw.exists === true)
}

export async function fileInfo(path) {
  const scan = scanApi()
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
