import type { ResourceId } from "../i18n";
import { RESOURCE_COLOR } from "../i18n";

function polygon(n: number, x: number, y: number, r: number, rot = -Math.PI / 2) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push(`${x + Math.cos(a) * r},${y + Math.sin(a) * r}`);
  }
  return pts.join(" ");
}

function star(x: number, y: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`);
  }
  return pts.join(" ");
}

function cross(x: number, y: number, r: number) {
  const w = r * 0.36;
  const h = r;
  return [
    `${x - w},${y - h}`,
    `${x + w},${y - h}`,
    `${x + w},${y - w}`,
    `${x + h},${y - w}`,
    `${x + h},${y + w}`,
    `${x + w},${y + w}`,
    `${x + w},${y + h}`,
    `${x - w},${y + h}`,
    `${x - w},${y + w}`,
    `${x - h},${y + w}`,
    `${x - h},${y - w}`,
    `${x - w},${y - w}`,
  ].join(" ");
}

const SHAPES: Record<ResourceId, (x: number, y: number, r: number) => string> = {
  ore: (x, y, r) => polygon(12, x, y, r, 0),
  silicon: (x, y, r) => polygon(4, x, y, r * 1.05),
  ice: (x, y, r) => polygon(4, x, y, r, 0),
  hydrogen: (x, y, r) => polygon(3, x, y, r * 1.15),
  helium: (x, y, r) => polygon(6, x, y, r, 0),
  methane: (x, y, r) => star(x, y, r * 1.1),
  nividium: (x, y, r) => polygon(5, x, y, r * 1.1),
  rawscrap: (x, y, r) => cross(x, y, r),
};

export function ResourceMarker({
  id,
  x,
  y,
  r,
  opacity,
}: {
  id: ResourceId;
  x: number;
  y: number;
  r: number;
  opacity: number;
}) {
  const c = RESOURCE_COLOR[id];
  const pts = SHAPES[id](x, y, r);
  return (
    <>
      <polygon
        points={pts}
        fill={c}
        fillOpacity={opacity}
        stroke="#0b1113"
        strokeWidth={Math.max(r * 0.16, 16)}
        strokeOpacity={0.75}
        style={{ pointerEvents: "none" }}
      />
      <polygon
        points={pts}
        fill="none"
        stroke={c}
        strokeWidth={Math.max(r * 0.1, 10)}
        strokeOpacity={Math.min(1, opacity + 0.25)}
        style={{ pointerEvents: "none" }}
      />
    </>
  );
}

/** 值在全部数据中的分位（0–1），用于决定标记大小与亮度。 */
export function percentileRank(sorted: number[], v: number): number {
  if (sorted.length <= 1) return 1;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return (lo - 1) / (sorted.length - 1);
}
