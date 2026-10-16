import { type CameraDrag, type NavigationStyleId } from "./navigation-style";
/** Legacy saved values are accepted but no longer change the controls. */
export type NavigationMode = "auto" | "mouse" | "trackpad";
export interface WheelSample {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  nativeSource?: "gesture" | "wheel" | null;
  wheelDeltaX?: number;
  wheelDeltaY?: number;
  devicePixelRatio?: number;
  momentum?: boolean;
}
export class WheelGestureClassifier {
  classify(
    event: WheelSample,
    _mode: NavigationMode,
    _time: number,
  ): "pan" | "zoom" {
    if (event.ctrlKey) return "zoom";
    if (event.nativeSource)
      return event.nativeSource === "gesture" ? "pan" : "zoom";
    if (event.deltaMode !== 0) return "zoom";
    if (event.momentum) return "pan";
    // Chromium retains discrete wheel ticks even when pixel deltas are tiny.
    const dpr = event.devicePixelRatio || 1;
    const ticks = [event.wheelDeltaX, event.wheelDeltaY].filter(
      (value): value is number => Number.isFinite(value) && value !== 0,
    );
    if (
      ticks.length &&
      ticks.every((value) => {
        const normalized = Math.abs(value * dpr) / 120;
        return (
          normalized >= 1 &&
          Math.abs(normalized - Math.round(normalized)) < 0.001
        );
      })
    )
      return "zoom";
    // Browsers omit native gesture phases. Precision/XY scrolling is the fallback;
    // identical DOM wheel events cannot identify hardware with certainty.
    if (
      ticks.length ||
      event.deltaX !== 0 ||
      Math.abs(event.deltaY) < 40 ||
      !Number.isInteger(event.deltaY)
    )
      return "pan";
    return "zoom";
  }
}
export interface NavigationModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}
export function pointerDrag(
  _style: NavigationStyleId,
  button: number,
  _modifiers: NavigationModifiers,
  is2D: boolean,
): CameraDrag {
  // One mapping applies to every saved preference and modifier combination.
  const action =
    button === 0 || button === 1 ? "pan" : button === 2 ? "orbit" : "none";
  return is2D && action === "orbit" ? "pan" : action;
}
/** OrbitControls swaps rotate/pan on modified presses; undo that swap once. */
export function orbitMouseAction(
  action: CameraDrag,
  modifiers: NavigationModifiers,
): "rotate" | "pan" | "dolly" | null {
  const modified = modifiers.shiftKey || modifiers.ctrlKey || modifiers.metaKey;
  if (action === "orbit") return modified ? "pan" : "rotate";
  if (action === "pan") return modified ? "rotate" : "pan";
  return action === "zoom" ? "dolly" : null;
}
export function wheelZoomSpeed(
  speed: number,
  reverse: boolean,
  ctrlPinch: boolean,
): number {
  return reverse && !ctrlPinch ? -speed : speed;
}
