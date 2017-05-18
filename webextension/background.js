
browser.runtime.sendMessage("getPrefs").then(prefs => {
  browser.storage.local.set(prefs);
});
