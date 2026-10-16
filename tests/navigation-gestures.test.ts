import { describe, expect, it } from "vitest";
import { WheelGestureClassifier } from "../src/core/navigation-gestures";
const sample = (
  deltaX: number,
  deltaY: number,
  deltaMode = 0,
  ctrlKey = false,
) => ({ deltaX, deltaY, deltaMode, ctrlKey });
describe("automatic wheel navigation", () => {
  it("pans smooth vertical, horizontal and fractional pixel swipes", () => {
    for (const event of [
      sample(0, 7),
      sample(120, 0),
      sample(0, 100.5),
      sample(8.5, 18.5),
    ])
      expect(new WheelGestureClassifier().classify(event, "auto", 0)).toBe(
        "pan",
      );
  });
  it("keeps pan stable through larger momentum events and resets after the gesture", () => {
    const classifier = new WheelGestureClassifier();
    expect(classifier.classify(sample(0, 8), "auto", 0)).toBe("pan");
    expect(classifier.classify(sample(0, 120), "auto", 16)).toBe("pan");
    expect(classifier.classify(sample(0, 100), "auto", 160)).toBe("pan");
    expect(classifier.classify(sample(0, 100), "auto", 400)).toBe("zoom");
  });
  it("preserves discrete pixel wheel notches, line and page scrolling as zoom", () => {
    for (const event of [
      sample(0, 100),
      sample(0, -120),
      sample(0, 3, 1),
      sample(0, 1, 2),
    ])
      expect(new WheelGestureClassifier().classify(event, "auto", 0)).toBe(
        "zoom",
      );
  });
  it("always zooms pinch and honors both explicit device modes", () => {
    const classifier = new WheelGestureClassifier();
    expect(classifier.classify(sample(3, 4), "auto", 0)).toBe("pan");
    for (const mode of ["auto", "mouse", "trackpad"] as const)
      expect(classifier.classify(sample(0, 2, 0, true), mode, 16)).toBe("zoom");
    expect(classifier.classify(sample(3, 4), "mouse", 32)).toBe("zoom");
    expect(classifier.classify(sample(0, 120), "trackpad", 48)).toBe("pan");
    expect(classifier.classify(sample(0, 100), "auto", 64)).toBe("zoom");
  });
  it("can identify a later smooth event after an ambiguous initial large pixel step", () => {
    const classifier = new WheelGestureClassifier();
    expect(classifier.classify(sample(0, 100), "auto", 0)).toBe("zoom");
    expect(classifier.classify(sample(0.25, 80), "auto", 16)).toBe("pan");
    expect(classifier.classify(sample(0, 100), "auto", 32)).toBe("pan");
  });
});
