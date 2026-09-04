class App extends $falcon.App {
  onLaunch(options) {
    super.onLaunch(options)
    console.log('[probe2] launch, Page=' + typeof $falcon.Page + ' App=' + typeof $falcon.App)
  }
  onShow() { super.onShow() }
  onHide() { super.onHide() }
  onDestroy() { super.onDestroy() }
}
export default App
