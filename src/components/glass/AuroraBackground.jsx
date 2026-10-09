import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

/*
 * LIQUID-GLASS: app-wide aurora behind every screen, so the glass chrome has
 * color to refract. Rendering is @paper-design/shaders-react's MeshGradient
 * (WebGL); a static CSS mesh (.aurora) paints underneath as the fallback.
 * Colors are read live from the Radix tokens in palette.css (muted steps of
 * jade, cyan, plum, gold, sand), so the shader always matches the theme.
 */
const STOPS = {
  light: ["--jade-5", "--cyan-4", "--sand-4", "--plum-4", "--gold-5", "--jade-3"],
  dark: ["--jade-4", "--cyan-3", "--sand-3", "--plum-3", "--gold-3", "--jade-2"],
};

function readPalette(theme) {
  const cs = getComputedStyle(document.documentElement);
  return STOPS[theme].map((v) => cs.getPropertyValue(v).trim() || "#cccccc");
}

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
  const [colors, setColors] = useState(() => readPalette(theme));
  useEffect(() => { setColors(readPalette(theme)); }, [theme]);
  return (
    <div className="aurora" data-tone={theme} aria-hidden="true">
      {gl ? (
        <MeshGradient
          className="aurora__shader"
          colors={colors}
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
