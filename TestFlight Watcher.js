// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: plane;
/*
TestFlight Watcher by FifiTheBulldog

A widget to watch for openings in TestFlight betas and notify you when a spot is available.
*/

/*
This script is intended to be used as a widget on your home screen. You may also set up automations in Shortcuts to run this script, to check for TestFlight openings at times other than the ones dictated by Scriptable's normal widget refresh interval.
*/

/*
Specify the default TestFlight ID or URL (either works) and the app name in the "prefs" object below (begins on line 49).
These will be overridden if the TestFlight link and app name are supplied as a widget parameter.

You can also use a dictionary of the same form as the shortcut parameter when running this script from a shortcut.
*/

/*
To specify the app name and TestFlight link as a widget parameter, use the following syntax in the widget configurator's "Parameter" field:

  TESTFLIGHT_ID|APP_NAME

where the TestFlight ID/link and app name are separated by a vertical bar (|).

For example:

  uN1vTqxk|Scriptable

specifies the Scriptable beta.
*/

/*
As mentioned above, you can also pass in arguments from a shortcut, using the Run Script action. There are three ways to do this:

- Use a dictionary with the same format as prefs as the shortcut parameter (recommended)
- Set the app name to be the first item in the Texts field, and set the TestFlight ID or URL as the first item in the URLs field
- Set the TestFlight ID or URL as the first item in the Texts field, and set the app name as the second item in the Texts field (similar to the order used for widget parameters)
*/

/*
Preferences - you can change these values:

- testFlight: TestFlight ID or URL
- appName: name of TestFlight app
- notify: whether to send a notification when there is an open beta spot. Defaults to true unless explicitly set to false.
- sound: whether the notification for an open beta spot should have a sound. Defaults to false.
*/

const prefs = {
  testFlight: "uN1vTqxk",
  appName: "Scriptable",
  notify: true,
  sound: false
};

/*
Happy TestFlight sniping!
*/

/* SCRIPT BEGINS HERE */

"use strict";

// Handle "Copy Link" notification action
// If you run this script with its URL scheme, and add a parameter called "copyTFLink" with a full TestFlight URL as its value, that will have the same effect as tapping the "Copy Link" action in a notification for when a beta spot is open.
if (args.queryParameters.copyTFLink) {
  Pasteboard.copyString(args.queryParameters.copyTFLink);
  return; // Exit script immediately
}

// In case prefs gets deleted
if (typeof prefs !== "object" || prefs === null) globalThis.prefs = {};

// Widget parameter overrides preferences in script
if (args.widgetParameter) {
  const paramElements = args.widgetParameter.trim().split("|");
  prefs.testFlight = paramElements[0].trim();
  if (paramElements.length > 1) {
    prefs.appName = paramElements.slice(1).join("|").trim();
  }
}

function paramsToPrefs(params) {
  for (const pref of ["testFlight", "appName", "notify", "sound"]) {
    if (pref in params) prefs[pref] = params[pref];
  }
}

// If run from a notification, attempt to use the userInfo property for prefs
if (args.notification) {
  paramsToPrefs(args.notification.userInfo);
}

// If run from a URL scheme, attempt to use the parameters for prefs
if (args.queryParameters) {
  paramsToPrefs(args.queryParameters);
}

// If run from a shortcut, attempt to use args.plainTexts and args.urls as input
if (args.plainTexts.length !== 0) {
  if (args.plainTexts.length > 1) {
    let i = 0;
    while (i < args.plainTexts.length) {
      if (args.plainTexts[i]) {
        switch (i) {
          case 0:
            prefs.testFlight = args.plainTexts[i];
            break;
          case 1:
            prefs.appName = args.plainTexts[i];
            break;
          default:
            continue;
        }
        i++;
      }
    }
  } else {
    if (args.urls.length !== 0) {
      prefs.testFlight = args.urls[0];
      prefs.appName = args.plainTexts[0];
    } else {
      prefs.testFlight = args.plainTexts[0];
    }
  }
}

// If run from a shortcut, attempt to use the shortcut parameter (overrides args.plainTexts and args.urls)
if (args.shortcutParameter) {
  paramsToPrefs(args.shortcutParameter);
}

// Default prefs
// Default to Scriptable beta if no beta specified in widget or prefs
// sound defaults to false unless explicitly set to true (or a truthy value)
if (!prefs.testFlight) prefs.testFlight = "uN1vTqxk";
if (!prefs.appName) {
  prefs.appName = (prefs.testFlight === "uN1vTqxk") ? "Scriptable" : "TestFlight";
}
if (!("notify" in prefs)) prefs.notify = true;

// Parse TestFlight link for ID
const testFlightID = prefs.testFlight
  // Remove any query
  .replace(/\?.*/, "")
  // Remove any trailing slash
  .replace(/\/$/, "")
  // Split URL by slashes
  .split("/")
  // Get last item (ID) in split URL
  .slice(-1)[0];

const testFlightURL = "https://testflight.apple.com/join/" + testFlightID;

// Download and scrape TestFlight page
const r = new Request(testFlightURL);
r.headers = {
  "Accept-Language": "en-us"
};
const wv = new WebView();
await wv.loadRequest(r);
const betaInfo = await wv.evaluateJavaScript(`
  "use strict";
  const statusText = document.getElementsByClassName("beta-status")[0]
    .getElementsByTagName("span")[0]
    .innerText;
  let status;
  if (statusText === "This beta is full.") status = "full";
  if (statusText.startsWith("This beta isn't accepting")) status = "closed";
  if (!status) status = "open";
  let iconURL;
  if (status !== "closed") {
    iconURL = document.getElementsByClassName("app-icon")[0]
      .style
      .backgroundImage;
  }
  completion({ status, iconURL });
`, true);

const widget = new ListWidget();

if (betaInfo.iconURL) {
  const imageReq = new Request(betaInfo.iconURL.match(/url\("(.*)"\)/)[1]);
  const icon = widget.addImage(await imageReq.loadImage());
  icon.centerAlignImage();
  icon.containerRelativeShape = true;

  widget.addSpacer(null);
}

const messageText = prefs.appName + " beta is " + betaInfo.status;

widget.addText(messageText).centerAlignText();

if (betaInfo.status === "open") {
  widget.backgroundColor = Color.green();
  
  if (prefs.notify) {
    const copyURL = new CallbackURL(URLScheme.forRunningScript());
    copyURL.addParameter("copyTFLink", testFlightURL);
    
    const n = new Notification();
    n.title = messageText;
    n.body = `Join the ${prefs.appName} beta now`;
    n.openURL = testFlightURL;
    if (prefs.sound) n.sound = "default";
    n.addAction("Copy Link", copyURL.getURL());
    n.schedule();
  }
}

// Preview widget unless environment is unsupported
if (!(config.runsInWidget || config.runsInNotification)) await widget.presentSmall();

Script.setWidget(widget);
if (config.runsWithSiri) Script.setShortcutOutput(messageText);
Script.complete();