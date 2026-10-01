export function HomeScene() {
  const left = [0.12, 0.34, 0.54, 0.72];
  const right = [0.1, 0.32, 0.52, 0.7];
  return (
    <svg viewBox="0 0 760 820" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="home-bloom" cx="50%" cy="42%" r="48%">
          <stop offset="0%" stopColor="var(--scene-glow)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--scene-glow)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--scene-glow)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="home-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--scene-glow)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--scene-glow)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="760" height="820" rx="28" fill="var(--scene-bg)" />
      <ellipse cx="380" cy="390" rx="280" ry="120" fill="url(#home-bloom)" />
      {Array.from({ length: 12 }, (_, index) => {
        const t = index / 11;
        const y = 360 + t * t * 430;
        const inset = t * 70;
        return (
          <line
            key={`h-${index}`}
            x1={70 + inset}
            y1={y}
            x2={690 - inset}
            y2={y}
            stroke="var(--scene-line-dim)"
            strokeWidth="1"
          />
        );
      })}
      {Array.from({ length: 9 }, (_, index) => {
        const x = 40 + index * 85;
        return (
          <line
            key={`v-${index}`}
            x1="380"
            y1="340"
            x2={x}
            y2="800"
            stroke="var(--scene-line-dim)"
            strokeWidth="1"
          />
        );
      })}
      <path
        d="M20 210 C 160 80, 280 120, 420 70"
        fill="none"
        stroke="var(--scene-glow)"
        strokeWidth="2"
        opacity="0.85"
      />
      {[
        { x: 90, y: 150, s: 54 },
        { x: 190, y: 118, s: 40 },
        { x: 280, y: 96, s: 28 },
        { x: 350, y: 78, s: 18 },
      ].map((cube) => (
        <Cube key={`${cube.x}-${cube.y}`} {...cube} />
      ))}
      {left.map((t, index) => (
        <Pedestal key={`l-${t}`} t={t} side={-1} product={index === 0 ? "shoe" : index === 1 ? "phones" : "none"} />
      ))}
      {right.map((t, index) => (
        <Pedestal key={`r-${t}`} t={t} side={1} product={index === 0 ? "case" : index === 1 ? "lamp" : "none"} />
      ))}
      <ellipse cx="380" cy="760" rx="220" ry="18" fill="url(#home-floor)" />
    </svg>
  );
}

function along(t: number, side: -1 | 1) {
  const y = 800 - t * 460;
  const spread = (1 - t) * 300;
  const w = (1 - t) * 150 + 28;
  const h = (1 - t) * 34 + 10;
  const x = 380 + side * spread - w / 2;
  return { x, y, w, h };
}

function Pedestal({
  t,
  side,
  product,
}: {
  t: number;
  side: -1 | 1;
  product: "shoe" | "phones" | "case" | "lamp" | "none";
}) {
  const { x, y, w, h } = along(t, side);
  const top = h * 0.45;
  return (
    <g>
      <polygon
        points={`${x},${y} ${x + w},${y} ${x + w * 0.82},${y - top} ${x + w * 0.18},${y - top}`}
        fill="var(--scene-face)"
        stroke="var(--scene-line)"
        strokeWidth="1.2"
      />
      <rect x={x} y={y} width={w} height={h} fill="var(--scene-cube)" stroke="var(--scene-line)" strokeWidth="1.2" />
      <line
        x1={x + 8}
        y1={y + h - 4}
        x2={x + w - 8}
        y2={y + h - 4}
        stroke="var(--scene-glow)"
        strokeWidth="2"
        opacity="0.8"
      />
      {product === "none" ? null : <ProductMark kind={product} cx={x + w / 2} cy={y - top - 8} scale={0.55 + (1 - t) * 0.7} />}
    </g>
  );
}

function ProductMark({
  kind,
  cx,
  cy,
  scale,
}: {
  kind: "shoe" | "phones" | "case" | "lamp";
  cx: number;
  cy: number;
  scale: number;
}) {
  const s = 28 * scale;
  if (kind === "shoe") {
    return (
      <path
        d={`M ${cx - s} ${cy} Q ${cx - s * 0.2} ${cy - s * 0.8} ${cx + s} ${cy - s * 0.15} L ${cx + s * 0.7} ${cy + s * 0.25} L ${cx - s * 0.85} ${cy + s * 0.2} Z`}
        fill="var(--scene-product)"
        stroke="var(--scene-glow)"
        strokeWidth="1.4"
      />
    );
  }
  if (kind === "phones") {
    return (
      <g fill="none" stroke="var(--scene-glow)" strokeWidth="1.6">
        <circle cx={cx - s * 0.45} cy={cy} r={s * 0.38} />
        <circle cx={cx + s * 0.45} cy={cy} r={s * 0.38} />
        <path d={`M ${cx - s * 0.2} ${cy - s * 0.28} Q ${cx} ${cy - s * 0.7} ${cx + s * 0.2} ${cy - s * 0.28}`} />
      </g>
    );
  }
  if (kind === "lamp") {
    return (
      <g fill="var(--scene-product)" stroke="var(--scene-glow)" strokeWidth="1.4">
        <path d={`M ${cx - s * 0.55} ${cy} Q ${cx} ${cy - s} ${cx + s * 0.55} ${cy} Z`} />
        <line x1={cx} y1={cy} x2={cx} y2={cy + s * 0.45} />
      </g>
    );
  }
  return (
    <rect
      x={cx - s * 0.45}
      y={cy - s * 0.35}
      width={s * 0.9}
      height={s * 0.55}
      rx="3"
      fill="var(--scene-product)"
      stroke="var(--scene-glow)"
      strokeWidth="1.4"
    />
  );
}

function Cube({ x, y, s }: { x: number; y: number; s: number }) {
  const h = s * 0.42;
  return (
    <g>
      <polygon
        points={`${x - s},${y + h} ${x},${y + h * 2} ${x},${y + h * 2 + s} ${x - s},${y + h + s}`}
        fill="var(--scene-cube)"
        stroke="var(--scene-line)"
        strokeWidth="1.2"
      />
      <polygon
        points={`${x + s},${y + h} ${x},${y + h * 2} ${x},${y + h * 2 + s} ${x + s},${y + h + s}`}
        fill="var(--scene-face)"
        stroke="var(--scene-line)"
        strokeWidth="1.2"
      />
      <polygon
        points={`${x},${y} ${x + s},${y + h} ${x},${y + h * 2} ${x - s},${y + h}`}
        fill="var(--scene-glow)"
        fillOpacity="0.28"
        stroke="var(--scene-glow)"
        strokeWidth="1.2"
      />
    </g>
  );
}
