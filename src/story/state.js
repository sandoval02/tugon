// Scroll-driven values. The GSAP timeline in Story.jsx writes them; the 3D scene reads them every frame.
// Kept outside React so scrolling never re-renders anything.
export const S = {
  p: 0, // story progress 0..1
  cam: 0, // camera pose: 0 hero, 1 above the clouds, 2 barangay map, 3 mission
  rot: Math.PI - 0.55, // model heading (hero is turned so Mt. Banahaw rises at the back)
  sway: 1, // hero idle motion + pointer parallax
  ghost: 1, // surrounding contour terrain (hero only)
  map: 1, // 0 = 3D-print look, 1 = map (elevation tint)
  clouds: 0,
  borders: 0, // barangay outlines drawn 0..1
  shift: 0, // desktop: slide the map right to make room for the panel
  mission: 0, // route + markers visible 0..1
  dispatch: 0,
  route: 0, // responder progress along the route 0..1
  interactive: false, // barangays can be hovered / tapped
  orbit: false, // dragging rotates the camera (map + mission)
  yaw: 0,
  pitch: 0,
  dragged: false,
  tour: 0, // barangay tour position 0..33 (scroll-driven)
  tourOn: false,
  zoom: 1, // map view zoom (buttons)
  panX: 0, // map view pan (right-drag / shift-drag)
  panZ: 0,
  hideBgy: false, // panels hidden: the camera uses the full screen
  hideMission: false,
  feature: 0, // app chapter: which feature is playing 0..6 (scroll-driven)
  appOn: false, // the app chapter owns the barangay highlights
  appX: 0, appY: 0, appZ: 0, // app chapter: the playing feature's focus point
  appSpan: 0, // ...and how much ground it needs in view (0 = the whole of Liliw)
  appYaw: 0, // ...and a turn of the viewing angle
};

export const MISSION_STEPS = [
  { k: "01", title: "Report received", body: "A resident reports a landslide blocking the road, with photos and GPS." },
  { k: "02", title: "Responder dispatched", body: "MAT Liliw assigns Rescue 1. The alarm rings on the responder’s phone." },
  { k: "03", title: "En route, tracked live", body: "The resident watches the unit climb toward them, with the arrival time." },
  { k: "04", title: "On scene", body: "Responders arrive and update the report until it is resolved." },
];
// which MISSION_STEPS entry is live right now
export const missionStage = () => (S.route >= 0.995 ? 3 : S.route > 0.001 ? 2 : S.dispatch > 0.5 ? 1 : 0);
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
