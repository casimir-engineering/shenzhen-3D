export type NavigationMode = "auto" | "mouse" | "trackpad";
export interface WheelSample {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}

/** WheelEvent exposes no device ID. Keep smooth pixel gestures stable through inertia. */
export class WheelGestureClassifier {
  private lastTime = -Infinity;
  private gesture?: "pan" | "zoom";
  classify(
    event: WheelSample,
    mode: NavigationMode,
    time: number,
  ): "pan" | "zoom" {
    if (event.ctrlKey) {
      this.gesture = undefined;
      this.lastTime = -Infinity;
      return "zoom";
    }
    if (mode !== "auto") return mode === "trackpad" ? "pan" : "zoom";
    const continued = time >= this.lastTime && time - this.lastTime < 180;
    this.lastTime = time;
    if (event.deltaMode !== 0) return (this.gesture = "zoom");
    const smooth =
      event.deltaX !== 0 ||
      !Number.isInteger(event.deltaY) ||
      (Math.abs(event.deltaY) > 0 && Math.abs(event.deltaY) < 80);
    if (smooth || (continued && this.gesture === "pan"))
      return (this.gesture = "pan");
    return (this.gesture = "zoom");
  }
}
