/* 
 * Drag-Select Link Text for Firefox
 * Copyright (C) 2014-2016 Kestrel
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

const TEXT_NODE = 3;
var overrideUnselectable = false;

var linkElement = null;

var window = document.defaultView;
window.addEventListener("mousedown", onMouseDown, true);

self.port.on("detach", function(reason) {
  if (reason == "disable") {
    window.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("click", onClickBlock, true);
    changeCursor("");
  }
});

self.port.on("cursor", changeCursor);

self.port.on("overrideUnselectable", function(override) {
  overrideUnselectable = override;
});

self.port.on("selectAll", function(multiSelect) {
  let selection = window.getSelection();
  let range = document.createRange();
  range.selectNodeContents(linkElement);
  if (!multiSelect) {
    selection.removeAllRanges();
  }
  selection.addRange(range);
  window.addEventListener("click", onClickBlock, true);
});

function onMouseDown(event) {
  // Use click count (detail) to ignore simulated mousedown
  if (event.detail != 0) {
    window.removeEventListener("click", onClickBlock, true);
    // Only interested in left mouse button, don't interfere when alt modifier
    // being used (possibly for text selection)
    if (event.button == 0 && !event.altKey) {
      let textLink = false;
      let point = { x: event.clientX, y: event.clientY };

      // Check that cursor is over selectable link text and not inside existing selection
      if (isSelectableTextLink(point) && !inSelection(point)) {
        textLink = true;
        linkElement = document.elementFromPoint(point.x, point.y);
        // Block mousedown event to prevent dragstart
        event.preventDefault();
      }
      self.port.emit("textLink", [textLink]);
    }
  }
}

function onClickBlock(event) {
  event.preventDefault();
  event.stopPropagation();
  window.removeEventListener("click", onClickBlock, true);
}

function isSelectableTextLink(point) {
  var foundtextnode = false;
  var pointel = document.elementFromPoint(point.x, point.y);
  var el = pointel;
  while (el) {
    // Can only select what is selectable
    if (window.getComputedStyle(el).MozUserSelect == "none") {
      if (overrideUnselectable) {
        el.style.MozUserSelect = "text";
      } else
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
  for (let i = 0, iLen = nodes.length; i < iLen; i++) {
    // Require direct child text nodes to contain non-space characters
    if (nodes[i].nodeType == TEXT_NODE && nodes[i].data.trim().length > 0) {
      let range = document.createRange();
      range.selectNode(nodes[i]);
      let rectList = range.getClientRects();  
      for (let j = 0, jLen = rectList.length; j < jLen; j++) {
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
  for (let i = 0, iLen = selection.rangeCount; i < iLen; i++) {
    let range = selection.getRangeAt(i);
    if (!range.collapsed && range.isPointInRange(caretPos.offsetNode, caretPos.offset)) {
      return true;
    }
  }
  return false;
}

function changeCursor(cursor) {
  if (linkElement) {
    var classList = linkElement.classList;
    switch (cursor) {
      case "text":
        classList.remove("dragselectlinktext-grabcursor");
        classList.add("dragselectlinktext-textcursor");
        break;
      case "grab":
        classList.remove("dragselectlinktext-textcursor");
        classList.add("dragselectlinktext-grabcursor");
        break;
      default:
        classList.remove("dragselectlinktext-textcursor");
        classList.remove("dragselectlinktext-grabcursor");
    }
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
