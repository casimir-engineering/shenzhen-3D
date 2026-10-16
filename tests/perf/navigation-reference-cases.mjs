// Independently recorded from the supplied CAD control reference, not imported
// from the implementation under test. Columns: plain, Shift, Ctrl, Meta, Shift+Ctrl.
export const modifiers = [
  [],
  ["Shift"],
  ["Control"],
  ["Meta"],
  ["Shift", "Control"],
];
export const referenceBindings = [
  {
    style: "onshape",
    middle: ["pan", "pan", "pan", "pan", "pan"],
    right: ["orbit", "pan", "pan", "pan", "pan"],
  },
  {
    style: "solidworks",
    middle: ["orbit", "zoom", "pan", "pan", "pan"],
    right: ["none", "none", "none", "none", "none"],
  },
  {
    style: "creo",
    middle: ["orbit", "pan", "zoom", "zoom", "pan"],
    right: ["none", "none", "none", "none", "none"],
  },
  {
    style: "rhino",
    middle: ["pan", "pan", "pan", "pan", "pan"],
    right: ["orbit", "pan", "zoom", "zoom", "pan"],
  },
  {
    style: "fusion",
    middle: ["pan", "orbit", "pan", "pan", "orbit"],
    right: ["none", "none", "none", "none", "none"],
  },
  {
    style: "blender",
    middle: ["orbit", "pan", "zoom", "zoom", "pan"],
    right: ["none", "none", "none", "none", "none"],
  },
];
export const wheelCases = [
  ...[
    1, 7, 40, 53, 100, 120, 0.25, 100.5, -1, -7, -40, -53, -100, -120, -0.25,
  ].map((deltaY) => ({ deltaX: 0, deltaY, deltaMode: 0 })),
  { deltaX: 14.5, deltaY: 22.5, deltaMode: 0 },
  { deltaX: -14.5, deltaY: -22.5, deltaMode: 0 },
  { deltaX: 0, deltaY: 1, deltaMode: 1 },
  { deltaX: 0, deltaY: -3, deltaMode: 1 },
  { deltaX: 0, deltaY: 1, deltaMode: 2 },
  { deltaX: 0, deltaY: -0.25, deltaMode: 2 },
];
