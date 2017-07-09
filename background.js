
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    browser.storage.local.set({dragThresholdX: defaultOptions.dragThresholdX,
                               dragThresholdY: defaultOptions.dragThresholdY});
  }
});