import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Viewer } from "../core/viewer";
import type { Pick } from "../core/types";
export interface ViewportHandle {
  viewer: Viewer | undefined;
}
export const Viewport = forwardRef<
  ViewportHandle,
  {
    onPick: (pick: Pick) => void;
    onHover: (text: string) => void;
    onReady: (viewer: Viewer) => void;
    onError: (message: string) => void;
  }
>(({ onPick, onHover, onReady, onError }, ref) => {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | undefined>(undefined);
  const pick = useRef(onPick);
  pick.current = onPick;
  const hover = useRef(onHover);
  hover.current = onHover;
  useImperativeHandle(
    ref,
    () => ({
      get viewer() {
        return viewer.current;
      },
    }),
    [],
  );
  useEffect(() => {
    try {
      const v = new Viewer(host.current!);
      viewer.current = v;
      v.onPick = (p) => pick.current(p);
      v.onHover = (t) => hover.current(t);
      onReady(v);
      return () => {
        v.dispose();
        viewer.current = undefined;
      };
    } catch (e) {
      onError(e instanceof Error ? e.message : "WebGL could not initialize");
    }
  }, []);
  return (
    <div
      ref={host}
      className="viewport-canvas"
      aria-label="3D model viewport"
      role="img"
    />
  );
});
