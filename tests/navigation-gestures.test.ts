import { describe, expect, it } from "vitest";
import {
  WheelGestureClassifier,
  pointerDrag,
  orbitMouseAction,
  wheelZoomSpeed,
} from "../src/core/navigation-gestures";
import {
  NAVIGATION_STYLES,
  DEFAULT_NAVIGATION_STYLE,
  isNavigationStyle,
  navigationStyle,
  navigationGestures,
} from "../src/core/navigation-style";
import { PerspectiveCamera, Vector3, MOUSE } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const plain = { shiftKey: false, ctrlKey: false, metaKey: false };
const sample = (
  deltaX: number,
  deltaY: number,
  deltaMode = 0,
  ctrlKey = false,
) => ({ deltaX, deltaY, deltaMode, ctrlKey });
describe("explicit wheel input", () => {
  it("uses vertical wheel zoom for mouse and legacy auto without guessing", () => {
    for (const mode of ["mouse", "auto"] as const)
      for (const delta of [
        sample(0, 1),
        sample(0, 7),
        sample(0, 53),
        sample(0, 100.5),
        sample(0, -120),
        sample(8.5, 18.5),
        sample(0, 2, 1),
        sample(0, 1, 2),
      ])
        expect(new WheelGestureClassifier().classify(delta, mode, 0)).toBe(
          "zoom",
        );
  });
  it("pans explicit trackpad XY swipes, and always zooms Ctrl pinch", () => {
    const c = new WheelGestureClassifier();
    for (const event of [sample(3, 4), sample(100, 0), sample(0, -120)])
      expect(c.classify(event, "trackpad", 0)).toBe("pan");
    for (const mode of ["mouse", "auto", "trackpad"] as const)
      expect(c.classify(sample(0, 2, 0, true), mode, 16)).toBe("zoom");
  });
  it("reverses only ordinary wheel zoom, leaving Ctrl pinch positive", () => {
    expect(wheelZoomSpeed(1.3, true, false)).toBe(-1.3);
    expect(wheelZoomSpeed(1.3, true, true)).toBe(1.3);
    expect(wheelZoomSpeed(1.3, false, false)).toBe(1.3);
  });
});
const expected = {
  onshape: [
    ["pan", "pan", "pan", "pan"],
    ["orbit", "pan", "pan", "pan"],
  ],
  solidworks: [
    ["orbit", "zoom", "pan", "pan"],
    ["none", "none", "none", "none"],
  ],
  creo: [
    ["orbit", "pan", "zoom", "pan"],
    ["none", "none", "none", "none"],
  ],
  rhino: [
    ["pan", "pan", "pan", "pan"],
    ["orbit", "pan", "zoom", "pan"],
  ],
  fusion: [
    ["pan", "orbit", "pan", "orbit"],
    ["none", "none", "none", "none"],
  ],
  blender: [
    ["orbit", "pan", "zoom", "pan"],
    ["none", "none", "none", "none"],
  ],
} as const;
const mods = [
  plain,
  { ...plain, shiftKey: true },
  { ...plain, ctrlKey: true },
  { ...plain, shiftKey: true, ctrlKey: true },
];
describe("navigation presets", () => {
  it("exports a validated default and accurate gesture help", () => {
    expect(DEFAULT_NAVIGATION_STYLE).toBe("onshape");
    expect(isNavigationStyle("unknown")).toBe(false);
    expect(navigationStyle("unknown" as never).id).toBe("onshape");
    expect(navigationGestures(navigationStyle("solidworks"), true)).toEqual({
      orbit: ["Middle-drag", "Drag on the model"],
      pan: ["Ctrl+middle-drag"],
      zoom: ["Scroll (reversed)", "Shift+middle-drag"],
    });
  });
  it("matches all presets, combined modifier priority, Meta alias and 2D locking", () => {
    for (const style of NAVIGATION_STYLES)
      for (const [i, button] of [1, 2].entries())
        for (const [j, m] of mods.entries()) {
          const action = expected[style.id][i][j];
          expect(pointerDrag(style.id, button, m, false)).toBe(action);
          expect(
            pointerDrag(
              style.id,
              button,
              { ...m, ctrlKey: false, metaKey: m.ctrlKey },
              false,
            ),
          ).toBe(action);
          expect(pointerDrag(style.id, button, m, true)).toBe(
            action === "orbit" ? "pan" : action,
          );
        }
  });
  it("keeps left model dragging orbiting, and maps it to pan for 2D", () => {
    for (const m of mods) {
      expect(pointerDrag("solidworks", 0, m, false)).toBe("orbit");
      expect(pointerDrag("solidworks", 0, m, true)).toBe("pan");
    }
  });
  it("compensates actual OrbitControls modifier handling exactly once", () => {
    class Document extends EventTarget {}
    class Canvas extends EventTarget {
      ownerDocument = new Document();
      style = {};
      clientWidth = 600;
      clientHeight = 400;
      getRootNode() {
        return this.ownerDocument;
      }
      setPointerCapture() {}
      releasePointerCapture() {}
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 600, height: 400 };
      }
    }
    for (const style of NAVIGATION_STYLES)
      for (const button of [1, 2])
        for (const m of mods)
          for (const is2D of [false, true]) {
            const element = new Canvas(),
              camera = new PerspectiveCamera(45, 1.5, 0.01, 1000);
            camera.position.set(4, -7, 6);
            camera.up.set(0, 0, 1);
            const controls = new OrbitControls(
              camera,
              element as unknown as HTMLElement,
            );
            const desired = pointerDrag(style.id, button, m, is2D),
              mapped = orbitMouseAction(desired, m);
            controls.mouseButtons[button === 1 ? "MIDDLE" : "RIGHT"] =
              mapped === "rotate"
                ? MOUSE.ROTATE
                : mapped === "pan"
                  ? MOUSE.PAN
                  : mapped === "dolly"
                    ? MOUSE.DOLLY
                    : null;
            const event = (type: string, x: number, y: number) =>
              Object.assign(new Event(type), {
                pointerId: 1,
                pointerType: "mouse",
                button,
                clientX: x,
                clientY: y,
                pageX: x,
                pageY: y,
                ...m,
              });
            const beforePosition = camera.position.clone(),
              beforeTarget = controls.target.clone(),
              beforeDirection = beforePosition
                .clone()
                .sub(beforeTarget)
                .normalize();
            element.dispatchEvent(event("pointerdown", 300, 200));
            element.ownerDocument.dispatchEvent(event("pointermove", 330, 220));
            const direction = camera.position
                .clone()
                .sub(controls.target)
                .normalize(),
              distance = camera.position.distanceTo(controls.target),
              beforeDistance = beforePosition.distanceTo(beforeTarget);
            if (desired === "pan") {
              expect(controls.target.distanceTo(beforeTarget)).toBeGreaterThan(
                0.001,
              );
              expect(direction.distanceTo(beforeDirection)).toBeLessThan(1e-8);
            }
            if (desired === "orbit") {
              expect(direction.distanceTo(beforeDirection)).toBeGreaterThan(
                0.001,
              );
              expect(controls.target.distanceTo(beforeTarget)).toBeLessThan(
                1e-8,
              );
            }
            if (desired === "zoom")
              expect(Math.abs(distance - beforeDistance)).toBeGreaterThan(
                0.001,
              );
            if (desired === "none")
              expect(camera.position.distanceTo(beforePosition)).toBeLessThan(
                1e-8,
              );
            element.ownerDocument.dispatchEvent(event("pointerup", 330, 220));
            controls.dispose();
          }
  });
});
