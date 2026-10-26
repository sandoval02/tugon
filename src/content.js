// All page copy lives here so the layout components stay small.

/* Edit when you publish a new build. */
export const RELEASE = {
  version: "1.0.0",
  // APK is >100 MB, too big for git: it is published as a GitHub Release asset.
  apk: "https://github.com/sandoval02/tugon/releases/latest/download/tugon.apk",
  ipa: "downloads/tugon.ipa",
};

// how installing works, shown step by step on each download card
export const INSTALL = {
  android: ["Download tugon.apk", "Allow installing from this browser", "Open TUGON and sign in"],
  apple: ["Download tugon.ipa", "Install it with AltStore or Sideloadly", "Trust the developer, then open TUGON"],
};

export const HOTLINES = [
  { name: "MAT Liliw", note: "Municipal action team · rescue", numbers: ["0945-135-0537", "0953-611-0440"] },
  { name: "Fire station", note: "Bureau of Fire Protection · Liliw", numbers: ["0956-769-0379"] },
  { name: "Police", note: "PNP Liliw", numbers: ["0906-360-4119"] },
];

// seconds each feature plays in the terrain demo before moving to the next
export const DEMO_SECONDS = 9;

export const FEATURES = [
  { icon: "siren", title: "Report in seconds", body: "File an incident or a complaint with photos and your exact location attached automatically." },
  { icon: "route", title: "Live responder tracking", body: "Follow your assigned responders on the map as they head to you, with an estimated time of arrival." },
  { icon: "bell", title: "Alerts that reach you", body: "Report updates and official announcements arrive even when the app is closed." },
  { icon: "pin", title: "Nearby facilities", body: "Evacuation centers, hospitals and fire stations near you, with directions." },
  { icon: "users", title: "Family circle", body: "Share your live location with people you trust and get alerted if one of them reports an emergency." },
  { icon: "bag", title: "Go-bag checklist", body: "Prepare before disaster strikes with a checklist you can make your own." },
];

export const MANUAL = [
  {
    id: "start", icon: "rocket", title: "Getting started", keywords: "install welcome login register guest browse begin",
    lead: "Open the app and choose how you want to continue.",
    steps: [
      "Open TUGON. On the <b>Welcome</b> screen you will see <b>Sign In</b>, <b>Create an Account</b> and <b>Browse as Guest</b>.",
      "<b>Browse as Guest</b> lets you look around: hotlines, facilities, announcements and the go-bag checklist work without an account.",
      "To report an emergency, track responders or use the family circle, tap <b>Create an Account</b> (or <b>Sign In</b> if you already have one).",
      "Used the wrong option? Tap the <b>back arrow</b> at the top-left of the Sign In screen to return to the Welcome screen.",
      "When asked, allow <b>Location</b> and <b>Notifications</b>. They are essential for accurate reports and for alerts.",
    ],
    tip: "<b>Tip:</b> You can switch between dark and light appearance in the app’s Profile settings.",
  },
  {
    id: "account", icon: "user", title: "Account & verification", keywords: "register sign up verify id selfie liveness password forgot reset otp email",
    lead: "A verified account helps responders trust and act on your reports faster.",
    steps: [
      "Tap <b>Create an Account</b>, enter your name, email and a strong password, and accept the Terms &amp; Conditions.",
      "Enter the verification code sent to your email.",
      "Open <b>Verify ID</b>: choose an ID type and take a clear photo of it.",
      "Complete the <b>liveness check</b> by following the on-screen prompts with your face in the frame.",
      "Forgot your password? On the Sign In screen tap <b>Forgot Password?</b>, enter your email, then follow the code and reset steps.",
    ],
    tip: "<b>Privacy:</b> Your ID and selfie are used only to verify your identity.",
  },
  {
    id: "report", icon: "siren", title: "Report an incident", keywords: "incident emergency fire accident medical crime sos location photo severity submit",
    lead: "Use this for emergencies that are happening now.",
    steps: [
      "On the Home screen tap the centre button and choose <b>Report Incident</b>.",
      "Pick the <b>category</b> (for example fire, medical, accident) and the <b>severity</b>.",
      "Describe what is happening in a few clear words.",
      "Tap <b>Attach photo</b> if it is safe to do so.",
      "Confirm the location with <b>Use current location</b>, or type the address.",
      "Tap <b>Submit</b>. Responders are notified immediately.",
    ],
    tip: "<b>In immediate danger?</b> Call the emergency hotlines first, then file the report.",
  },
  {
    id: "complaint", icon: "note", title: "File a complaint", keywords: "complaint concern issue community report title category evidence history timeline",
    lead: "For community concerns that are not urgent emergencies.",
    steps: [
      "Tap the centre button and choose <b>File Complaint</b>.",
      "Enter a title, a description and select a category.",
      "Attach photos as evidence and set the location.",
      "Tap <b>Submit</b>. Follow progress in the <b>Reports</b> tab under <b>Complaints</b>.",
      "Tap any complaint to see its <b>timeline</b>: every status change and action, from submission to resolution.",
    ],
  },
  {
    id: "track", icon: "route", title: "Track responders", keywords: "track map eta responder dispatched arrive call status live incident",
    lead: "For incidents: know who is coming and when they will arrive.",
    steps: [
      "When your incident is <b>Dispatched</b>, open the <b>Track</b> tab.",
      "Watch the responder’s live position and the estimated arrival time on the map.",
      "Tap the responder marker to see their name and status.",
      "Tap <b>Call</b> to contact the assigned responder directly.",
      "After the response is <b>Resolved</b>, you will be asked to rate it. See <i>Chat &amp; feedback</i>.",
    ],
  },
  {
    id: "alerts", icon: "bell", title: "Notifications", keywords: "notification alert announcement push bell closed background sound",
    lead: "Stay informed even when the app is closed.",
    steps: [
      "Allow notifications when the app first asks. You can change this later in your phone settings.",
      "Tap the <b>bell</b> icon on Home to read all notifications and tap <b>Mark all as read</b> when done.",
      "Open <b>Announcements</b> for official advisories from your local government.",
      "Tap a notification on your lock screen to jump straight to the related report or announcement.",
    ],
    tip: "<b>Tip:</b> On some phones, set TUGON to <b>“Unrestricted”</b> battery use so alerts are never delayed.",
  },
  {
    id: "safety", icon: "map", title: "Maps & safety tools", keywords: "heatmap facilities evacuation hospital hotline go bag checklist map directions",
    lead: "Resources you can use before, during and after an emergency.",
    steps: [
      "<b>Hotlines</b>: tap a number to call police, fire, and the local response team in one tap.",
      "<b>Facilities</b>: see evacuation centers, hospitals and fire stations near you, then tap <b>Get directions</b>.",
      "<b>Heatmap</b>: view areas with many recent incidents so you can avoid or prepare.",
      "<b>Go-bag checklist</b>: tick off essentials and add your own items.",
    ],
  },
  {
    id: "family", icon: "users", title: "Family circle", keywords: "family circle share location invite member alert trusted",
    lead: "Keep the people you trust within reach.",
    steps: [
      "Open <b>Family Circle</b> from the Home quick actions.",
      "Create a circle or join one using an invite code from a family member.",
      "Choose whether to share your live location with the circle.",
      "If a member reports an emergency, everyone in the circle gets an alert with the details and location.",
    ],
    tip: "<b>You are in control:</b> You can stop sharing or leave a circle at any time.",
  },
  {
    id: "chat", icon: "chat", title: "Chat & feedback", keywords: "chat message feedback rating rate review responder contact",
    lead: "Talk to responders and help improve the service.",
    steps: [
      "Open the <b>Chat</b> list from Home to message the people handling your report.",
      "Send text updates or photos to help them find you.",
      "When a report is resolved, tap <b>Feedback</b>, give a star rating and leave a short comment.",
    ],
  },
  {
    id: "trouble", icon: "tool", title: "Troubleshooting", keywords: "problem error not working slow location permission login update battery",
    lead: "Quick fixes for common problems.",
    steps: [
      "<b>Not receiving alerts?</b> Check that Notifications are allowed for TUGON and battery optimisation is turned off for the app.",
      "<b>Wrong location?</b> Turn on GPS / precise location and stay outdoors for a few seconds, then try again.",
      "<b>Cannot sign in?</b> Check your email and password, or use <b>Forgot Password?</b>.",
      "<b>Report is slow to send?</b> Make sure you have mobile data or Wi-Fi. The app retries automatically.",
      "<b>Still stuck?</b> Open <b>Profile → Help &amp; FAQ</b> inside the app.",
    ],
  },
];

export const FAQ = [
  { q: "Is TUGON free?", a: "Yes. TUGON is free for all citizens." },
  { q: "Do I need an account to use it?", a: "You can browse as a guest, but you need a verified account to report incidents, track responders and use the family circle." },
  { q: "Does TUGON use my location all the time?", a: "Your location is used when you submit a report and, only if you choose, when sharing with a family circle.", demo: "location" },
  { q: "Will I get alerts when the app is closed?", a: "Yes, as long as notifications are allowed and battery optimisation is disabled for TUGON." },
  { q: "Is it safe to install the APK?", a: "Only download TUGON from this official page. Android asks for permission to install apps from outside the Play Store; allow it just for this install." },
];
