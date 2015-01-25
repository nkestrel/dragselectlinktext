## Drag-Select Link Text 
Firefox browser extension.

![](/icon.png)

**Select link text with easy drag gestures.**

The ability to drag links interferes with the ability to select text inside them, requiring careful cursor placement on the outside edges of the link or holding the alt key. The latter is cumbersome and can cause unwanted actions, releasing too early clicks the link and sometimes the menu bar appears as it shares the same key-mapping. Drag gestures offer a better balance of functionality.

Three different types of gestures are available:

* **Horizontal** - Exceeding drag threshold horizontally selects text, vertically drags link. Similar to Opera 12.
* **Hold** - Exceeding drag threshold after hold time elapses selects text, before drags link.
* **Immediate** - Exceeding drag threshold before hold time elapses selects text, after drags link.


The size of the drag threshold in each direction and the length of the hold time are adjustable. In the case of the horizontal drag gesture, making the thresholds asymmetric can be used to make one action easier to perform than the other. For the other gestures, when the hold time elapses the cursor icon changes to indicate the action to be performed when the threshold is exceeded.

Holding a modifier key (eg ctrl, shift) always initiates selection when leaving the drag threshold.

Selection is done using mouse events at the browser level for maximum compatibility.

Official Firefox support tracked by [Bug 378775](https://bugzilla.mozilla.org/show_bug.cgi?id=378775).