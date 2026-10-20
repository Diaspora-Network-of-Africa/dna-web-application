// The app's one software-keyboard measurement (ruling 1457). Moved out of Composer.tsx unchanged:
// the keyboard's height is what the layout viewport loses under the visual viewport, from
// visualViewport's resize and scroll, and anything at or under 80px is read as no keyboard.
// Every reader takes it from here; no surface writes a second listener of its own.
import { useEffect, useState } from "react";

export type KeyboardViewport = {
  /** Software keyboard height in px; 0 when no keyboard or no visualViewport. */
  height: number;
  /** visualViewport.height while the keyboard is up; 0 otherwise. */
  viewportHeight: number;
  /** visualViewport.offsetTop while the keyboard is up; 0 otherwise. */
  offsetTop: number;
  /** visualViewport.pageTop while the keyboard is up, so a reader sees the window move (1905); 0 otherwise. */
  pageTop: number;
};

const NONE: KeyboardViewport = { height: 0, viewportHeight: 0, offsetTop: 0, pageTop: 0 };

/** The keyboard and the visible area it leaves, while `active`. All zero when no keyboard or API. */
export function useKeyboardViewport(active: boolean): KeyboardViewport {
  const [kb, setKb] = useState<KeyboardViewport>(NONE);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) {
      setKb(NONE);
      return;
    }
    const f = () => {
      // Pinch-zoom shrinks the visual viewport too; only an unzoomed viewport is read as a keyboard.
      if (Math.abs(vv.scale - 1) > 0.01) {
        setKb(NONE);
        return;
      }
      const h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const next =
        h > 80
          ? { height: h, viewportHeight: vv.height, offsetTop: vv.offsetTop, pageTop: vv.pageTop }
          : NONE;
      setKb((prev) =>
        prev.height === next.height &&
        prev.viewportHeight === next.viewportHeight &&
        prev.offsetTop === next.offsetTop &&
        prev.pageTop === next.pageTop
          ? prev
          : next,
      );
    };
    f();
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => {
      vv.removeEventListener("resize", f);
      vv.removeEventListener("scroll", f);
    };
  }, [active]);
  return kb;
}

/** Software keyboard height on touch devices, from visualViewport. 0 when no keyboard or API. */
export function useKeyboardHeight(active: boolean): number {
  return useKeyboardViewport(active).height;
}
