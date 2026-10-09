import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

/*
 * LIQUID-GLASS: app-wide aurora behind every screen, so the glass chrome has
 * vivid color to refract. Rendering is @paper-design/shaders-react's
 * MeshGradient (WebGL); a static CSS mesh (.aurora) paints underneath as the
 * fallback when WebGL is unavailable or before the first frame.
 * Palette = the section hues (blue, violet, emerald, pink, cyan, gold). No orange.
 */
const PALETTE = {
  light: ["#7aa2ff", "#b69cff", "#5fe0c0", "#ff9fd0", "#7fd8f2", "#ffe08a"],
  dark: ["#1d3a9e", "#4c1d95", "#065f46", "#831843", "#0e5f78", "#3b2a7a"],
};

function readTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function AuroraBackground() {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [gl] = useState(hasWebGL);
  return (
    <div className="aurora" data-tone={theme} aria-hidden="true">
      {gl ? (
        <MeshGradient
          className="aurora__shader"
          colors={PALETTE[theme]}
          distortion={0.85}
          swirl={0.35}
          grainMixer={0}
          grainOverlay={0}
          speed={reduce ? 0 : 0.12}
          frame={reduce ? 18000 : undefined}
          maxPixelCount={1280 * 900}
          minPixelRatio={1}
        />
      ) : null}
      <div className="aurora__veil" />
    </div>
  );
}
