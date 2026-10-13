"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Point = [number, number];

type Run = {
  shelf: Point;
  reseller: Point;
  door: Point;
  duration: number;
  offset: number;
  depth: number;
  hold: number;
};

/** Companies list, a reseller passes the order, a shop ships, the buyer gets it. */
const RUNS: readonly Run[] = [
  { shelf: [0.44, 0.34], reseller: [0.3, 0.54], door: [0.14, 0.84], duration: 15000, offset: 0, depth: 0.28, hold: 0.16 },
  { shelf: [0.5, 0.32], reseller: [0.5, 0.5], door: [0.5, 0.88], duration: 18000, offset: 0.2, depth: 0.16, hold: 0.38 },
  { shelf: [0.57, 0.34], reseller: [0.72, 0.55], door: [0.86, 0.84], duration: 14000, offset: 0.46, depth: 0.4, hold: 0.55 },
  { shelf: [0.47, 0.4], reseller: [0.36, 0.62], door: [0.26, 0.9], duration: 12000, offset: 0.64, depth: 0.72, hold: 0.74 },
  { shelf: [0.54, 0.4], reseller: [0.64, 0.63], door: [0.74, 0.9], duration: 13000, offset: 0.08, depth: 0.84, hold: 0.9 },
  { shelf: [0.5, 0.37], reseller: [0.46, 0.58], door: [0.38, 0.86], duration: 16000, offset: 0.82, depth: 0.56, hold: 0.28 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function along(run: Run, phase: number): Point {
  if (phase < 0.5) {
    const t = smooth(phase / 0.5);
    return [lerp(run.shelf[0], run.reseller[0], t), lerp(run.shelf[1], run.reseller[1], t)];
  }
  const t = smooth((phase - 0.5) / 0.5);
  return [lerp(run.reseller[0], run.door[0], t), lerp(run.reseller[1], run.door[1], t)];
}

function roundBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s * 0.62, y);
  ctx.lineTo(x + s * 0.62, y + s * 0.72);
  ctx.lineTo(x - s * 0.62, y + s * 0.72);
  ctx.lineTo(x - s * 0.62, y);
  ctx.closePath();
  ctx.stroke();
}

export function XvAisleFlow({ density = "full" }: { density?: "full" | "light" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const parent = canvas.parentElement ?? canvas;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let offscreen = true;
    let paused = true;
    let reduced = reduceQuery.matches;
    let raf = 0;
    let px = 0;
    let py = 0;
    const trails: Point[][] = RUNS.map(() => []);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const mobile = width < 768;
      const count = density === "light" || mobile ? 3 : RUNS.length;
      const allowPointer = density === "full" && !mobile && fineQuery.matches && !reduced;
      const shiftX = allowPointer ? px * 18 : 0;
      const shiftY = allowPointer ? py * 10 : 0;
      const glow = reduced ? 0.16 : 0.12 + Math.sin(now / 1600) * 0.04;
      const bloom = ctx.createRadialGradient(width * 0.5, height * 0.34, 20, width * 0.5, height * 0.4, width * 0.42);
      bloom.addColorStop(0, `rgba(61, 220, 132, ${glow})`);
      bloom.addColorStop(1, "rgba(61, 220, 132, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);

      const runs = RUNS.slice(0, count)
        .map((run, index) => ({ run, index }))
        .sort((a, b) => a.run.depth - b.run.depth);

      for (const { run, index } of runs) {
        const phase = reduced ? run.hold : (now / run.duration + run.offset) % 1;
        const depthShift = (run.depth - 0.5) * 2;
        const [nx, ny] = along(run, phase);
        const x = nx * width + shiftX * depthShift;
        const y = ny * height + shiftY * depthShift;
        const midX = run.reseller[0] * width + shiftX * depthShift;
        const midY = run.reseller[1] * height + shiftY * depthShift;
        const doorX = run.door[0] * width + shiftX * depthShift;
        const doorY = run.door[1] * height + shiftY * depthShift;
        const scale = (density === "light" ? 0.7 : 0.85) * (0.55 + run.depth);

        const history = trails[index] ?? [];
        if (!reduced && !paused) {
          history.push([x, y]);
          if (history.length > 14) history.shift();
        }
        for (let i = 1; i < history.length; i += 1) {
          const prev = history[i - 1];
          const next = history[i];
          if (!prev || !next) continue;
          ctx.strokeStyle = `rgba(185, 255, 214, ${((i / history.length) * 0.35).toFixed(3)})`;
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(next[0], next[1]);
          ctx.stroke();
        }

        const ripple = reduced ? 0.28 : phase > 0.42 && phase < 0.64 ? 1 - Math.abs(phase - 0.52) / 0.12 : 0;
        if (ripple > 0) {
          ctx.beginPath();
          ctx.arc(midX, midY, (10 + ripple * 28) * scale, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(61, 220, 132, ${(0.45 * (1 - ripple * 0.65)).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(midX, midY, 3.5 * scale, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(61, 220, 132, 0.45)";
          ctx.fill();
        }

        const flash = reduced ? (run.hold > 0.8 ? 0.7 : 0.2) : phase > 0.84 ? 1 - (phase - 0.84) / 0.16 : 0;
        if (flash > 0) {
          const light = ctx.createRadialGradient(doorX, doorY, 2, doorX, doorY, 36 * scale);
          light.addColorStop(0, `rgba(210, 255, 226, ${0.55 * flash})`);
          light.addColorStop(1, "rgba(61, 220, 132, 0)");
          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.arc(doorX, doorY, 36 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = flash > 0.4 ? "rgba(233, 255, 242, 0.95)" : "rgba(61, 220, 132, 0.7)";
        ctx.lineWidth = 1.4;
        drawHouse(ctx, doorX, doorY - 4, 8 * scale);

        const lift = phase < 0.12 ? 1 - phase / 0.12 : 0;
        const fade = phase < 0.08 ? phase / 0.08 : phase > 0.94 ? (1 - phase) / 0.06 : 1;
        ctx.save();
        ctx.translate(x, y - lift * 14);
        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.max(0, Math.min(1, fade));
        ctx.fillStyle = "rgba(214, 255, 230, 0.95)";
        ctx.strokeStyle = "rgba(61, 220, 132, 0.95)";
        ctx.lineWidth = 1.5;
        roundBox(ctx, -9, -6, 18, 12, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };

    const tick = (now: number) => {
      raf = 0;
      if (paused) return;
      draw(now);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced || paused || raf) return;
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const syncPause = () => {
      paused = offscreen || document.hidden;
      if (paused) stop();
      else start();
    };

    resize();
    const observer = new IntersectionObserver(
      ([entry]) => {
        offscreen = !entry?.isIntersecting;
        syncPause();
        if (reduced) draw(0);
      },
      { threshold: 0.08 },
    );
    observer.observe(parent);

    const onResize = () => {
      resize();
      if (reduced || paused) draw(performance.now());
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);

    const onPointer = (event: PointerEvent) => {
      if (density !== "full" || reduced) return;
      px = event.clientX / window.innerWidth - 0.5;
      py = event.clientY / window.innerHeight - 0.5;
    };
    const onHide = () => syncPause();
    const onReduce = () => {
      reduced = reduceQuery.matches;
      for (const trail of trails) trail.length = 0;
      if (reduced) {
        stop();
        draw(0);
      } else {
        start();
      }
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    reduceQuery.addEventListener("change", onReduce);
    if (reduced) draw(0);

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onHide);
      reduceQuery.removeEventListener("change", onReduce);
    };
  }, [density]);

  return <canvas ref={ref} className={density === "light" ? "xv-flow xv-flow-light" : "xv-flow"} aria-hidden />;
}

/** Slower shift for the aisle photo behind the parcels. */
export function AisleParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    if (reduce.matches) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    let sy = 0;
    const write = () => {
      raf = 0;
      const mobile = window.innerWidth < 768;
      const pointerX = fine.matches && !mobile ? px * -14 : 0;
      const pointerY = fine.matches && !mobile ? py * -8 : 0;
      const scrollY = mobile ? 0 : Math.min(sy, 700) * -0.025;
      node.style.transform = `translate3d(${pointerX}px, ${pointerY + scrollY}px, 0)`;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onPointer = (event: PointerEvent) => {
      px = event.clientX / window.innerWidth - 0.5;
      py = event.clientY / window.innerHeight - 0.5;
      kick();
    };
    const onScroll = () => {
      sy = window.scrollY;
      kick();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className="hero-aisle-back">
      {children}
    </div>
  );
}
