import { BasePage } from './base-page.js'

class App extends $falcon.App {
  onLaunch(options) {
    super.onLaunch(options)
    try {
      console.log('[shuge] launch env=' + JSON.stringify($falcon.env || {}).slice(0, 200))
    } catch (e) { /* 日志失败不影响启动 */ }
    $falcon.useDefaultBasePageClass(BasePage)
  }
  onShow() { super.onShow() }
  onHide() { super.onHide() }
  onDestroy() { super.onDestroy() }
}
export default App
