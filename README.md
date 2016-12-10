## Drag-Select Link Text 
Firefox browser extension.

![](/icon.png)

**Select link text with easy mouse gestures.**

**NEW FEATURE:** Select all of a link's text by holding mouse button down for adjustable hold time.

Selecting link text has never been so easy! Don't fumble trying to select link text from the outside edges, using trial and error to get the right cursor placement and making bad selection after bad selection. Don't mash the Alt key only to click the link by accident or trigger the menubar. Just do a simple mouse gesture on the link exactly where you want selection to start.

Three different types of gestures are available:

* **Horizontal** - Select text by dragging horizontally. Similar to Opera 12.
* **Hold** - Select text by holding and waiting for the hold time to elapse before dragging.
* **Immediate** - Select text by immediately dragging before the hold time elapses.


If selection is not started when leaving the drag threshold then the link will be dragged instead. The size of the drag threshold in each direction and the length of the hold time are adjustable, the cursor changes when the hold time elapses so you know when to start dragging.

Holding a modifier key (eg ctrl, shift) will always select. Selection is done using low level simulated mouse events for maximum compatibility. Advanced option available to override the CSS rule that prevents text selection, note that pseudo-elements still cannot be selected ([Bug 12460](https://bugzilla.mozilla.org/show_bug.cgi?id=12460)).

Official Firefox support for the horizontal selection gesture is tracked by [Bug 378775](https://bugzilla.mozilla.org/show_bug.cgi?id=378775).
