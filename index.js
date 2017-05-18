/*
 * Drag-Select Link Text
 * Firefox Web Extension
 * Copyright (C) 2014-2017 Kestrel
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const webExtension = require("sdk/webextension"),
      simplePrefs = require("sdk/simple-prefs"),
      prefService = require("sdk/preferences/service");


webExtension.startup().then(api => {
  const {browser} = api;

  browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
    if (msg == "getPrefs") {
      let prefs = {
        "selectGesture":          simplePrefs.prefs.selectGesture,
        "holdTimeMS":             simplePrefs.prefs.holdTimeMS,
        "selectAllHoldTimeMS":    simplePrefs.prefs.selectAllHoldTimeMS,
        "changeCursor":           simplePrefs.prefs.changeCursor,
        "overrideUnselectable":   simplePrefs.prefs.overrideUnselectable,
        "dragThresholdX":         simplePrefs.prefs.dragThresholdX,
        "dragThresholdY":         simplePrefs.prefs.dragThresholdY
      };

      let options = {};
      for (let key of Object.keys(prefs)) {
        if (typeof prefs[key] != "undefined") {
          let newKey = key;
          let newValue = prefs[key];
          switch (key) {
            case "selectGesture":
              if (["horizontalSelect", "holdSelect", "immediateSelect"].indexOf(newValue) < 0) {
                newValue = "horizontalSelect";
              }
              break;
            case "holdTimeMS":
              newKey = "holdTimeSec";
              newValue = Math.max(0, Math.round(prefs[key] / 100) / 10);
              break;
            case "selectAllHoldTimeMS":
              newKey = "holdAllTimeSec";
              newValue = Math.max(0, Math.round(prefs[key] / 100) / 10);
              break;
            case "dragThresholdX":
            case "dragThresholdY":
              newValue = undefined;
              break;
          }
          if (typeof newValue != "undefined") {
            options[newKey] = newValue;
          }
          prefService.reset("extensions.dragselectlinktext@kestrel." + key);
        }
      }

      if (Object.keys(options).length > 0) {
        sendReply(options);
      }
    }
  });
});