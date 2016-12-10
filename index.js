/* 
 * Drag-Select Link Text for Firefox
 * Copyright (C) 2014-2016 Kestrel
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

// Need chrome for sendMouseEvent
const {Ci} = require("chrome"),
  selectGesture = {
    horizontal: "horizontalSelect",
    hold: "holdSelect",
    immediate: "immediateSelect"
  };
 
var windows = require("sdk/windows").browserWindows,
  utils = require("sdk/window/utils"),
  simplePrefs = require("sdk/simple-prefs"),
  pageMod = require("sdk/page-mod"),
  self = require("sdk/self"),

  // Preferences
  pref_selectGesture,
  pref_dragThresholdX,
  pref_dragThresholdY,
  pref_holdTimeMS,
  pref_selectAllHoldTimeMS,
  pref_changeCursor,
  pref_overrideUnselectable,

  // State
  downEvent,
  downWindow,
  workerPort,
  downOnTextLink = false,
  dragging = false,
  cursorChanged = false,
  selectedAll = false,
  holdTimeout,
  selectAllHoldTimeout;


exports.main = function() {
  // Init preferences and catch changes
  onPrefChange('');
  simplePrefs.on("", onPrefChange);

  // Attach content script to all pages and iframes 
  pageMod.PageMod({
    include: ["*"], 
    contentScriptFile: self.data.url("content-script.js"),
    contentStyleFile: self.data.url("cursors.css"),
    onAttach: pageAttach,
    attachTo: ["existing", "frame", "top"], 
    contentScriptWhen: "start"
  });
  
  // Enumerate existing windows and catch new
  for (var window of utils.windows("navigator:browser", { includePrivate: true })) {
    winLoad(window);
  }  
  windows.on("open", onWinOpen); 
}

exports.onUnload = function (reason) { 
  if (reason != "shutdown") {
    windows.on("open", function(){});
    for (var window of utils.windows("navigator:browser", { includePrivate: true })) {
      winUnload(window);
    }
  }
}

function onWinOpen(browserWindow) {
  winLoad(utils.getMostRecentBrowserWindow());
}

function pageAttach(worker) {
  if (pref_overrideUnselectable)
    worker.port.emit("overrideUnselectable", pref_overrideUnselectable);
  
  worker.port.on("textLink", function(payload) {
    workerPort = this; 
    downOnTextLink = payload[0];
    if (downWindow && downOnTextLink) {
      // Change cursor after hold time to give visual feedback
      if (pref_selectGesture == selectGesture.hold || 
          pref_selectGesture == selectGesture.immediate) {
        holdTimeout = downWindow.setTimeout(function() {
          holdTimeout = null;
          if (pref_changeCursor) {
            switch(pref_selectGesture) {
              case selectGesture.hold:
                changeCursor("text");
                break;
              case selectGesture.immediate:
                changeCursor("grab");
                break;
            }
          }
        }, pref_holdTimeMS);
      }

      // Select full link after select hold time
      selectAllHoldTimeout = downWindow.setTimeout(function() {
        changeCursor("grab");
        selectedAll = true;
        if (workerPort) {
          workerPort.emit("selectAll", downEvent.ctrlKey || downEvent.metaKey);
        }
        downWindow.removeEventListener("mousemove", onMouseMove, true);
      }, pref_selectAllHoldTimeMS);

      // Only attach mousemove listener when needed
      downWindow.addEventListener("mousemove", onMouseMove, true);
    }
  });
  
  worker.on("pagehide", function(event) {
    // Worker only relevant when page is visible
    workerPort = null; 
    cursorChanged = false;
  });
}

function onMouseDown(event) {
  // Left button down, use click count (detail) to filter simulated mousedown
  if (event.button == 0 && event.detail != 0) {
    downEvent = event;
    downWindow = event.currentTarget;
    dragging = false;
    downOnTextLink = false;
  }
}  

function onMouseMove(event) {
  if (downWindow && downEvent) {
    // Exceed drag threshold
    if (Math.abs(event.screenX - downEvent.screenX) > pref_dragThresholdX || 
        Math.abs(event.screenY - downEvent.screenY) > pref_dragThresholdY) {
      // Immediately cancel hold timeout and remove mousemove listener
      downWindow.clearTimeout(holdTimeout);
      downWindow.clearTimeout(selectAllHoldTimeout);
      downWindow.removeEventListener("mousemove", onMouseMove, true);
      
      // Modifiers always do selection (alt modifier never gets to this point)
      let select = downEvent.ctrlKey || downEvent.shiftKey || downEvent.metaKey;
      // Drag method, default to horizontal
      if (!select) {
        switch (pref_selectGesture) {
          case selectGesture.hold:
            select = holdTimeout == null;
            break;
          case selectGesture.immediate:
            select = holdTimeout != null;
            break;
          default:
            select = Math.abs(event.screenY - downEvent.screenY) <= pref_dragThresholdY;
        }
      }

      // Require window utils to generate browser mouse event
      let wutils = downWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                             .getInterface(Ci.nsIDOMWindowUtils);
      let mods = parseModifiers(downEvent); 
      // Make event coordinates relative to main window viewport
      let point = { x: downEvent.screenX - downWindow.mozInnerScreenX, 
                    y: downEvent.screenY - downWindow.mozInnerScreenY };

      // Send mousedown event to initiate selection or drag, use click count of zero to 
      // prevent click event and indicate to content script that it is not a real event 
      // and should be ignored
      if (select) {
        changeCursor("text");
        // alt modifier required to make selection
        mods |= wutils.MODIFIER_ALT;
        wutils.sendMouseEvent("mousedown", point.x, point.y, 0, 0, mods);
      } else {
        if (cursorChanged)
          changeCursor("");
        dragging = true;
        wutils.sendMouseEvent("mousedown", point.x, point.y, 0, 0, mods);
        // Move enough to fire drag event, won't return until drag is finished
        wutils.sendMouseEvent("mousemove", point.x, point.y + 1000, 0, 0, mods);
      }
      
      downEvent = null;
      downWindow = null;
    }
  }
}

function onMouseUp(event) {
  cleanup();
  if (selectedAll) {
    event.preventDefault();
    selectedAll= false;
  }
}

function onDragStart(event) {
  if (downOnTextLink && !dragging) {
    event.preventDefault();
  }
}

function onDragEnd(event) {
  dragging = false;
  cleanup();
}

function cleanup() {
  if (downWindow) {
    downWindow.clearTimeout(holdTimeout);
    downWindow.clearTimeout(selectAllHoldTimeout);
    downWindow.removeEventListener("mousemove", onMouseMove, true);
  }
  if (cursorChanged)
    changeCursor("");
  downOnTextLink = false;
  downEvent = null;
  downWindow = null;
}

function winLoad(window) {
  window.addEventListener("mousedown", onMouseDown, true); 
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("dragstart", onDragStart, true);
  window.addEventListener("dragend", onDragEnd, true);
}

function winUnload(window) {
  window.removeEventListener("mousedown", onMouseDown, true);
  window.removeEventListener("mousemove", onMouseMove, true); 
  window.removeEventListener("mouseup", onMouseUp, true);
  window.removeEventListener("dragstart", onDragStart, true);
  window.removeEventListener("dragend", onDragEnd, true);
}

function onPrefChange(prefName) {
  pref_selectGesture = simplePrefs.prefs.selectGesture;
  pref_dragThresholdX = simplePrefs.prefs.dragThresholdX;
  pref_dragThresholdY = simplePrefs.prefs.dragThresholdY;
  pref_holdTimeMS = simplePrefs.prefs.holdTimeMS;
  pref_selectAllHoldTimeMS = simplePrefs.prefs.selectAllHoldTimeMS;
  pref_changeCursor = simplePrefs.prefs.changeCursor;
  pref_overrideUnselectable = simplePrefs.prefs.overrideUnselectable;
}

function changeCursor(type) {
  if (pref_changeCursor)
    // Can only change cursor when page is visible
    if (workerPort) {
      cursorChanged = type != "";
      workerPort.emit("cursor", type);      
    }
}

function parseModifiers(aEvent) {
  var wutils  = Ci.nsIDOMWindowUtils;
  var mods = 0;
  if (aEvent.shiftKey)
    mods |= wutils.MODIFIER_SHIFT;
  if (aEvent.ctrlKey)
    mods |= wutils.MODIFIER_CONTROL;
  if (aEvent.altKey)
    mods |= wutils.MODIFIER_ALT;
  if (aEvent.metaKey)
    mods |= wutils.MODIFIER_META;
  if (aEvent.accelKey)
    mods |= (navigator.platform.indexOf("Mac") >= 0) ? wutils.MODIFIER_META :
                                                       wutils.MODIFIER_CONTROL;
  return mods;
}
