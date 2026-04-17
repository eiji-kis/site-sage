"use client";

import { useEffect, useState } from "react";

import Aurora from "@/components/Aurora";

/** Violet / cyan stops aligned with `.dark` theme in `globals.css`. */
const BRAND_AURORA_STOPS = ["#7c3aed", "#38bdf8", "#c084fc"];

export function AmbientBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function onChange() {
      setReduceMotion(mq.matches);
    }
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="app-mesh">
        {reduceMotion ? null : (
          <div className="absolute inset-0 opacity-[0.42] mix-blend-screen">
            <Aurora colorStops={BRAND_AURORA_STOPS} amplitude={1.05} blend={0.48} speed={0.85} />
          </div>
        )}
        <div className="app-mesh-glow" />
      </div>
    </div>
  );
}
