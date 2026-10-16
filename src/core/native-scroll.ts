declare global {
  interface Window {
    shenzhenScroll?: { source(epochMs: number): "gesture" | "wheel" | null };
  }
}
export {};
