"use client";

import { useEffect, useRef } from "react";

const lanes = [
  "M -40 500 C 160 470, 320 390, 520 360 S 900 280, 1260 220",
  "M -40 580 C 200 540, 420 470, 680 410 S 1040 330, 1260 300",
];

/** Moving cubes and flowing lines over the hero photo. Not a logo. */
export function HomeScene() {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (media.matches) node.pauseAnimations();
      else node.unpauseAnimations();
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg ref={svg} className="home-flow absolute inset-0 h-full w-full" viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice">
        {lanes.map((path) => (
          <g key={path}>
            <path className="flow-glow" d={path} />
            <path className="flow-line" d={path} />
          </g>
        ))}
        {lanes.map((path, index) => (
          <rect key={path} className="flow-cube" x="520" y="352" width="16" height="16" rx="2">
            <animateMotion dur={`${18 + index * 4}s`} begin={`${index * -6}s`} repeatCount="indefinite" path={path} />
          </rect>
        ))}
      </svg>
    </div>
  );
}
