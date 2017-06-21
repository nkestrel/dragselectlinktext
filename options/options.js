/*
 * Drag-Select Link Text
 * Firefox Web Extension
 * Copyright (C) 2014-2017 Kestrel
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

function saveOption(e) {
  let value;
  switch (e.target.type) {
    case "number":
      if (e.target.validity.valid) {
        value = parseFloat(e.target.value);
      }
      break;
    case "checkbox":
      value = e.target.checked;
      break;
    default:
      value = e.target.value;
  }
  if (value != null) {
    let name = e.target.name;
    if (value === defaultOptions[name]) {
      browser.storage.local.remove(name);
    } else {
      browser.storage.local.set({[name]: value});
    }
  }
}


function restoreOptions(event) {
  browser.storage.local.get(defaultOptions).then((results) => {
    for (let key of Object.keys(results)) {
      let value = results[key];
      for (let el of document.getElementsByName(key)) {
        switch(el.type) {
          case "checkbox":
            el.checked = value;
            break;
          case "radio":
            el.checked = (el.value == value);
            break;
          case "number":
            el.value = value.toString();
            break;
          default:
            el.value = value;
        }
      }
    }
  });
}


function restoreDefaults() {
  if (window.confirm(browser.i18n.getMessage("options_dialog_restoreDefaults"))) {
    browser.storage.local.clear();
    restoreOptions();
  }
}


document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("btndefault").addEventListener("click", restoreDefaults);

let labels = document.getElementsByTagName("label");
for (let label of labels) {
  let inputId = label.getAttribute("for");
  if (inputId) {
    label.textContent = browser.i18n.getMessage("options_" + inputId);
  }
}

let titles = document.getElementsByClassName("text-section-header");
for (let title of titles) {
  title.textContent = browser.i18n.getMessage("options_" + title.id);
}

let inputs = document.querySelectorAll("input, select");
for (let input of inputs) {
  input.addEventListener("input", saveOption);
  if (input.type == "button") {
    input.value = browser.i18n.getMessage("options_" + input.id);
  }
}