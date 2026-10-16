import {
  navigationStyle,
  type CameraDrag,
  type NavigationStyleId,
} from "./navigation-style";
/** Kept for older saved preferences; automatic mode behaves like a mouse, with no device guessing. */
export type NavigationMode = "auto" | "mouse" | "trackpad";
export interface WheelSample {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}
export class WheelGestureClassifier {
  classify(
    event: WheelSample,
    mode: NavigationMode,
    _time: number,
  ): "pan" | "zoom" {
    return mode === "trackpad" && !event.ctrlKey ? "pan" : "zoom";
  }
}
export interface NavigationModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}
export function pointerDrag(
  style: NavigationStyleId,
  button: number,
  modifiers: NavigationModifiers,
  is2D: boolean,
): CameraDrag {
  const action =
    button === 0
      ? "orbit"
      : button === 1 || button === 2
        ? navigationStyle(style).drag(button === 1 ? "middle" : "right", {
            shift: modifiers.shiftKey,
            ctrl: modifiers.ctrlKey || modifiers.metaKey,
          })
        : "none";
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
