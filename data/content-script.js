/* 
 * Drag-Select Link Text for Firefox
 * Copyright (C) 2014 Kestrel
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

const TEXT_NODE = 3;

var window = document.defaultView;
window.addEventListener("mousedown", onMouseDown, true);

self.port.on("detach", function(reason) {
  if (reason == "disable") {
    console.log("detach disable");
    window.removeEventListener("mousedown", onMouseDown, true);
    changeCursor("");
  }
});

self.port.on("cursor", changeCursor);

function onMouseDown(event) {
  console.log("mousedown content");
  // Only interested in left mouse button, use click count (detail) to ignore simulated mousedown,
  // don't interfere when alt modifier being used (possibly for text selection)
  if (event.button == 0 && event.detail != 0 && !event.altKey) {
    var selectableTextLink = false;
    var point = { x: event.clientX, y: event.clientY };
    console.log("mousedown point x: " + point.x + " y: " + point.y );

    // Check that cursor is over selectable link text and not inside existing selection
    if (isSelectableTextLink(point) && !inSelection(point)) {
      selectableTextLink = true;
      // Block mousedown event to prevent dragstart
      event.preventDefault();
    }
    self.port.emit("selectableTextLink", [selectableTextLink]);
  }
}

function isSelectableTextLink(point) {
  var foundtextnode = false;
  var pointel = document.elementFromPoint(point.x, point.y);
  var el = pointel;
  while (el) {
    // Can only select what is selectable
    if (window.getComputedStyle(el).MozUserSelect == "none") {
      console.log("unselectable");
      return false;
    }
    if (!foundtextnode && el.tagName && el.tagName.toLowerCase() == 'a') {
      if (isTextNode(point))
        foundtextnode = true;
    }
    el = el.parentElement;
  }
  return foundtextnode;
}

function isTextNode(point) {
  var el = document.elementFromPoint(point.x, point.y);
  var downrect = el.getBoundingClientRect();
  var pointInsideBox = pointInRect(point, downrect);
  var nodes = el.childNodes;
  console.log('downrect: ' + downrect.left + " " + downrect.right + " " + downrect.top + " " + downrect.bottom);
  for (var i = 0, iLen = nodes.length; i < iLen; i++) {
    // Require direct child text nodes to contain non-space characters
    if (nodes[i].nodeType == TEXT_NODE && nodes[i].data.trim().length > 0) {
      var range = document.createRange();
      range.selectNode(nodes[i]);
      var rectList = range.getClientRects();  
      for (var j = 0, jLen = rectList.length; j < jLen; j++) {
        console.log('textrect: ' + rectList[j].left + " " + rectList[j].right + " " + rectList[j].top + " " + rectList[j].bottom); 
        if (rectList[j].width > 0 && rectList[j].height > 0) {
          if (pointInsideBox) {
            // Can start selection anywhere inside element box as long as a text range is inside
            if (intersectRect(rectList[j], downrect))
              return true;
          } else {
            // For text overflowing the element box, can only start selection directly over it
            if (pointInRect(point, rectList[j]))
              return true;
          }
        }
      }
    }
  }
  return false;
}

function inSelection(point) {
  var caretPos = document.caretPositionFromPoint(point.x, point.y);
  var selection = window.getSelection();
  for (var i = 0, iLen = selection.rangeCount; i < iLen; i++) {
    var range = selection.getRangeAt(i);
    if (!range.collapsed && range.isPointInRange(caretPos.offsetNode, caretPos.offset)) {
      console.log("in selection");
      return true;
    }
  }
  return false;
}

function changeCursor(cursor) {
  console.log("cursor: " + cursor);
  var classList = window.document.body.classList;  
  if (cursor == "text") {
    classList.remove("dragselectlinktext-grabcursor");
    classList.add("dragselectlinktext-textcursor");
  } else if (cursor == "grab") {  
    classList.remove("dragselectlinktext-textcursor");
    classList.add("dragselectlinktext-grabcursor");
  } else { 
    classList.remove("dragselectlinktext-textcursor");
    classList.remove("dragselectlinktext-grabcursor");
  }
}

function pointInRect(point, rect) {
  return (rect.left <= point.x && point.x <= rect.right) && 
         (rect.top <= point.y && point.y <= rect.bottom);
}

function intersectRect(r1, r2) {
  return !(r2.left >= r1.right || 
           r2.right <= r1.left || 
           r2.top >= r1.bottom ||
           r2.bottom <= r1.top);
}