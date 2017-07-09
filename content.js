/*
 * Drag-Select Link Text
 * Firefox Web Extension
 * Copyright (C) 2014-2017 Kestrel
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const
  CLASS_SELECTABLE = "dragselectlinktext-selectable",
  CLASS_TEXT_CURSOR = "dragselectlinktext-textcursor",
  CLASS_GRAB_CURSOR = "dragselectlinktext-grabcursor",

  SELECT_GESTURE = {
    HORIZONTAL: "horizontalSelect",
    HOLD: "holdSelect",
    IMMEDIATE: "immediateSelect",
  },

  GESTURE_CURSOR = {
    [SELECT_GESTURE.HOLD]: CLASS_TEXT_CURSOR,
    [SELECT_GESTURE.IMMEDIATE]: CLASS_GRAB_CURSOR,
  },

  HOLD_GESTURES = [
    SELECT_GESTURE.HOLD,
    SELECT_GESTURE.IMMEDIATE,
  ];

var
  options,
  downEvent,
  manualSelecting,
  selectedAll,
  holdTimeout,
  holdSelectAllTimeout,
  mousemovePoint,
  selectionChanged;

window.addEventListener("mousedown", onMouseDown, true);


browser.storage.local.get(defaultOptions).then((items) => {
  options = items;
  cursorChanger.enabled = options.changeCursor;
  selectableChanger.enabled = options.overrideUnselectable;
});


browser.storage.onChanged.addListener(function(changes, areaName) {
  let changedItems = Object.keys(changes);
  for (item of changedItems) {
    let value = changes[item].newValue;
    if (typeof value === "undefined") {
      value = defaultOptions[item];
    }
    options[item] = value;

    if (item == "changeCursor") {
      cursorChanger.enabled = value;
    } else if (item == "overrideUnselectable") {
      selectableChanger.enabled = value;
    }
  }
});


function onMouseDown(event) {
  // Left mouse button only
  if (event.button !== 0) {
    return;
  }

  window.removeEventListener("click", onLeftClickBlock, true);
  selectionChanged = false;

  downEvent = event;
  let point = { x: event.clientX, y: event.clientY};

  // Not inside existing selection
  if (inSelection(point)) {
    return;
  }

  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("dragend", onDragEnd, true);
  window.addEventListener("selectionchange", onSelectionChange, true);

  // Cursor must be over selectable link text for dragstart listener and hold timers.
  // Don't interfere when Alt modifier being used (possibly for text selection).
  if (isSelectableTextLink(event.target, point) && !event.altKey) {

    window.addEventListener("dragstart", onDragStart, true);

    // Change cursor after hold time to give visual feedback except when modifier
    // keys are pressed which force selection.
    let selectModifier = hasModifierKey(event);
    if (HOLD_GESTURES.includes(options.selectGesture) && !selectModifier) {
      holdTimeout = window.setTimeout(function() {
        holdTimeout = null;
        cursorChanger.set(event.target, GESTURE_CURSOR[options.selectGesture]);
      }, options.holdTimeSec * 1000);
    }

    // Select all timer
    holdSelectAllTimeout = window.setTimeout(function() {
      window.clearTimeout(holdTimeout);
      cursorChanger.set(event.target, CLASS_GRAB_CURSOR);
      selectAll(event.target, selectModifier);
      window.addEventListener("click", onLeftClickBlock, true);
      window.removeEventListener("mousemove", onMouseMove, true);
    }, options.holdAllTimeSec * 1000);
  }
}


function onMouseUp(event) {
  cleanup("mouseup");
}


function onMouseMove(event) {
  let selection = window.getSelection();

  // Do manual selection, don't need to make elements selectable since it
  // doesn't recognize selectability.
  if (manualSelecting) {
    if (!mousemovePoint) {
      startManualSelect(downEvent.clientX,
                        downEvent.clientY,
                        hasModifierKey(downEvent),
                        !downEvent.shiftKey);
    } else {
      let range = getCaretRangeFromPoint(event.clientX, event.clientY);
      if (range) {
        // Extending selection does not consider selectability so intermediate
        // unselectable elements may be selected.
        selection.extend(range.startContainer, range.startOffset);
      }
    }
  } else {
    // Block click when selection changed and threshold exceeded
    if (selectionChanged &&
        (Math.abs(event.screenX - downEvent.screenX) > options.dragThresholdX ||
         Math.abs(event.screenY - downEvent.screenY) > options.dragThresholdY)) {
      window.addEventListener("click", onLeftClickBlock, true);
      cursorChanger.set(downEvent.target, CLASS_TEXT_CURSOR);
      selectionChanged = false;

      // Remove mousemove listener if no longer needed
      if (!options.overrideUnselectable) {
        window.removeEventListener("mousemove", onMouseMove, true);
      }
    }

    if (options.overrideUnselectable) {
      // Get element under point as cannot rely on event.target
      let el = document.elementFromPoint(event.clientX, event.clientY);
      // Only change selectability when necessary
      if (!selectableTester.test(el)) {
        selectableChanger.set(el, CLASS_SELECTABLE);
        selectableTester.update(el, true);
      }
    }
  }

  // Save mousemove point so drag direction can be determined on dragstart
  mousemovePoint = {screenX: event.screenX,
                    screenY: event.screenY};
}


function onSelectionChange(event) {
  let selection = window.getSelection();
  if (!selection.isCollapsed) {
    window.removeEventListener("selectionchange", onSelectionChange, true);
    // Block click when selection changed
    if (manualSelecting) {
      window.addEventListener("click", onLeftClickBlock, true);
      cursorChanger.set(downEvent.target, CLASS_TEXT_CURSOR);
    } else {
      selectionChanged = true;
    }
  }
}


function onDragStart(event) {
  let deltaX,
      deltaY;

  // Measure system drag threshold size
  if (mousemovePoint) {
    deltaX = Math.abs(mousemovePoint.screenX - event.screenX) + 1;
    if (deltaX > options.dragThresholdX) {
      options.dragThresholdX = deltaX;
      browser.storage.local.set({dragThresholdX: deltaX});
    }
    deltaY = Math.abs(mousemovePoint.screenY - event.screenY) + 1;
    if (deltaY > options.dragThresholdY) {
      options.dragThresholdY = deltaY;
      browser.storage.local.set({dragThresholdY: deltaY});
    }
  }

  if (selectedAll) {
    return;
  }

  // Modifiers always do selection
  let doSelect = hasModifierKey(event);
  if (!doSelect) {
    switch (options.selectGesture) {
      case SELECT_GESTURE.HOLD:
        doSelect = holdTimeout == null;
        break;
      case SELECT_GESTURE.IMMEDIATE:
        doSelect = holdTimeout != null;
        break;
      default:
        // SELECT_GESTURE.HORIZONTAL
        // dragstart can occur before mousemove for fast movements,
        // can't determine direction so assume selecting (more often the case)
        doSelect = !mousemovePoint || deltaX > deltaY;
        break;
    }
  }

  if (doSelect) {
    // Prevent drag from starting
    event.preventDefault();
    event.stopPropagation();
    manualSelecting = true;
    mousemovePoint = null;
  }

  cleanup("dragstart");
}


function onDragEnd(event) {
  cleanup("mouseup");
}


function onLeftClickBlock(event) {
  // Block left mouse button
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  window.removeEventListener("click", onLeftClickBlock, true);
}


function cleanup(cleanupEvent) {
  window.clearTimeout(holdTimeout);
  window.clearTimeout(holdSelectAllTimeout);
  window.removeEventListener("dragstart", onDragStart, true);

  if (cleanupEvent == "mouseup") {
    manualSelecting = false;
    selectedAll = false;
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("dragend", onDragEnd, true);
    window.removeEventListener("selectionchange", onSelectionChange, true);
    cursorChanger.clear();
    selectableChanger.clear();
    selectableTester.clear();
    downEvent = null;
    mousemovePoint = null;
  }
}


function isSelectableTextLink(element, point) {
  // Don't need to override selectability for links to do manual select but
  // do for "select all" dragging to work.
  // Changing selectability has a performance cost so only do it when necessary.
  if (!selectableTester.test(element)) {
    if (options.overrideUnselectable) {
      selectableChanger.set(element, CLASS_SELECTABLE);
      selectableTester.update(element, true);
    } else {
      return false;
    }
  }

  let el = element;
  while (el) {
    if (el instanceof HTMLAnchorElement) {
      return isTextNode(element, point);
    }
    el = el.parentElement;
  }
  return false;
}


function isTextNode(element, point) {
  // Note that calling this for large scrollbars can make them less responsive
  let downrect = element.getBoundingClientRect();
  let pointInsideBox = pointInRect(point, downrect);
  let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (testNode(walker.currentNode)) {
      return true;
    }
  }
  return false;

  function testNode(node) {
    // Text nodes must contain non-space characters
    if (node.data && node.data.trim().length > 0) {
      let range = document.createRange();
      range.selectNode(node);
      let rects = range.getClientRects();
      for (let rect of rects) {
        if (rect.width > 0 && rect.height > 0) {
          if (pointInsideBox) {
            // Allow selection to start anywhere inside element box as long
            // as a text range is inside
            if (intersectRect(rect, downrect)) {
              return true;
            }
          } else {
            // For text overflowing the element box, can only start selection
            // directly over it
            if (pointInRect(point, rect)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}


function inSelection(point) {
  let selection = window.getSelection();
  if (!selection.isCollapsed) {
    let caretPos = document.caretPositionFromPoint(point.x, point.y);
    if (caretPos && caretPos.offsetNode) {
      for (let i = 0, iLen = selection.rangeCount; i < iLen; i++) {
        let range = selection.getRangeAt(i);
        if (!range.collapsed &&
            range.isPointInRange(caretPos.offsetNode, caretPos.offset)) {
          return true;
        }
      }
    }
  }
  return false;
}


function getCaretRangeFromPoint(x, y) {
  let el = document.elementFromPoint(x, y);
  if (options.overrideUnselectable || selectableTester.test(el)) {
    let caretPos = document.caretPositionFromPoint(x, y);
    if (caretPos && caretPos.offsetNode) {
      let range = document.createRange();
      range.setStart(caretPos.offsetNode, caretPos.offset);
      range.collapse(true);
      return range;
    }
  }
}


function startManualSelect(x, y, multiSelect, moveAnchor) {
  let selection = window.getSelection();
  if (!multiSelect) {
    selection.removeAllRanges();
  }
  // Don't move anchor for shift selection
  if (moveAnchor) {
    let range = getCaretRangeFromPoint(x, y);
    if (range) {
      selection.addRange(range);
    }
  }
}


function selectAll(element, multiSelect) {
  let selection = window.getSelection();
  if (!multiSelect) {
    selection.removeAllRanges();
  }
  let range = document.createRange();
  range.selectNodeContents(element);
  selection.addRange(range);
  selectedAll = true;
}


// Object to add and later remove classes to/from elements
var ClassListChanger = {
  enabled: true,
  _changed: [],

  set: function(element, value) {
    if (this.enabled &&
        element &&
        !(element instanceof HTMLDocument) &&
        !element.classList.contains(value)) {
      element.classList.add(value);
      this._changed.push({element, value});
    }
  },

  clear: function() {
    for (let change of this._changed) {
      if (change.element) {
        change.element.classList.remove(change.value);
      }
    }
    this._changed = [];
  },
}

var cursorChanger = Object.create(ClassListChanger);
var selectableChanger = Object.create(ClassListChanger);


// Object to test and remember element selectability
var SelectTester = {
  _tested: [],

  test: function(element) {
    let tested = this._tested.find(function(item) {
      return item.element === element;
    });
    if (tested) {
      return tested.selectable;
    } else {
      let selectable = this.isSelectable(element);
      this._tested.push({element, selectable});
      return selectable;
    }
  },

  update: function(element, selectable) {
    let index = this._tested.findIndex(function(item) {
      return item.element === element;
    });
    this._tested.splice(index, 1, {element, selectable});
  },

  isSelectable: function(element) {
    // Should only start selection in selectable element with selectable parents.
    let el = element;
    while (el) {
      let style = window.getComputedStyle(el);
      if (style.MozUserSelect == "none") {
        return false;
      } else if (style.MozUserSelect == "text") {
        return true;
      }
      el = el.parentElement;
    }
    return true;
  },

  clear: function() {
    this._tested = [];
  },
}

var selectableTester = Object.create(SelectTester);


function hasModifierKey(event) {
  return event.ctrlKey ||
         event.shiftKey ||
         event.metaKey;
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
