import type { Cluster, Sector, Vec2 } from "../types";

/** 原始站点：单个星区 / 星区群在银河中的绘图高度。 */
export const CELL_W = 4950;
export const CELL_H = 8580;

type Dir = "L" | "R" | "T" | "B" | "M";

/** 星区内部坐标缩放（zone / item 的偏移量乘以它）。 */
export function innerScale(sectorCount: number) {
  const sx = [250, 500, 500];
  const sy = [300, 500, 500];
  return { x: CELL_W / sx[sectorCount - 1], y: CELL_H / sy[sectorCount - 1] };
}

/**
 * 星区群内每个星区的格子方位。
 * 移植自 Quantum Anomaly 的原版布局算法，改动会直接改变整体版式，慎动。
 */
const dirCache = new WeakMap<Cluster, Dir[][]>();

function layoutDirs(cluster: Cluster): Dir[][] {
  const cached = dirCache.get(cluster);
  if (cached) return cached;
  const n: Dir[][] = cluster.sectors.map(() => []);

  cluster.sectors.forEach((s, c) => {
    const [x, z] = s.pos;
    if (x < 0) n[c].push("L");
    if (x > 0) n[c].push("R");
    if (z < 0) n[c].push("B");
    if (z > 0) n[c].push("T");
  });

  n.forEach((own, c) => {
    let d = false;
    let f = false;
    let m = false;
    let g = false;
    let y = false;
    let x = false;
    let S = false;
    let b = false;
    n.forEach((w, E) => {
      if (c === E) return;
      if (w.includes("T") && w.includes("R")) d = true;
      if (w.includes("T") && w.includes("L")) f = true;
      if (w.includes("B") && w.includes("R")) m = true;
      if (w.includes("B") && w.includes("R")) g = true;
      if (w.includes("T")) y = true;
      if (w.includes("B")) x = true;
      if (w.includes("R")) S = true;
      if (w.includes("L")) b = true;
    });
    if (d && !own.includes("T") && !own.includes("B")) n[c].push("B");
    if (d && !own.includes("L") && !own.includes("R")) n[c].push("L");
    if (f && !own.includes("T") && !own.includes("B")) n[c].push("B");
    if (f && !own.includes("L") && !own.includes("R")) n[c].push("R");
    if (m && !own.includes("T") && !own.includes("B")) n[c].push("T");
    if (m && !own.includes("L") && !own.includes("R")) n[c].push("L");
    if (g && !own.includes("T") && !own.includes("B")) n[c].push("T");
    if (g && !own.includes("L") && !own.includes("R")) n[c].push("R");
    if (y && !own.includes("T") && !own.includes("B")) n[c].push("B");
    if (x && !own.includes("T") && !own.includes("B")) n[c].push("T");
    if (S && !own.includes("R") && !own.includes("L")) n[c].push("L");
    if (b && !own.includes("R") && !own.includes("L")) n[c].push("R");

    if (cluster.sectors.length > 2) {
      const order = cluster.sectors
        .map((s, i) => ({ z: s.pos[1], i }))
        .sort((a, b2) => b2.z - a.z)
        .map((o) => o.i);
      const E = n[order[0]].includes("L") ? "L" : "R";
      n[order[0]] = ["T", E];
      n[order[1]] = ["M", E === "L" ? "R" : "L"];
      n[order[2]] = ["B", E];
    }
  });

  const SPECIAL = ["Cluster_42_connection", "Cluster_104_connection"];
  n.forEach((own, c) => {
    if (own.length === 2) return;
    let d = false;
    let f = false;
    n.forEach((m) => {
      if (m.includes("T") || m.includes("B")) d = true;
      if (m.includes("R") || m.includes("L")) f = true;
    });
    if (!d && f && c === 0 && !own.includes("T") && !own.includes("B")) {
      n[c].push(SPECIAL.includes(cluster.name) ? "T" : "B");
      n[c + 1].push(SPECIAL.includes(cluster.name) ? "B" : "T");
    }
    if (d && !f && c === 0 && !own.includes("L") && !own.includes("R")) {
      n[c].push(SPECIAL.includes(cluster.name) ? "L" : "R");
      n[c + 1].push(SPECIAL.includes(cluster.name) ? "R" : "L");
    }
  });

  dirCache.set(cluster, n);
  return n;
}

/** 该星区相对星区群中心的偏移。 */
export function sectorOffset(cluster: Cluster, sector: Sector): { x: number; y: number } {
  if (cluster.sectors.length === 1) return { x: 0, y: 0 };
  const n = layoutDirs(cluster);
  const idx = cluster.sectors.findIndex((s) => s.name === sector.name);
  const own = n[idx] ?? [];
  let a = 0;
  let s = 0;
  if (own.includes("L")) a = -CELL_W / 2;
  if (own.includes("R")) a = CELL_W / 2;
  if (own.includes("T") && !own.includes("M")) s = -CELL_H / 2;
  if (own.includes("B") && !own.includes("M")) s = CELL_H / 2;
  if (own.includes("M") && own.includes("R")) a += CELL_W / 2;
  if (own.includes("M") && own.includes("L")) a -= CELL_W / 2;
  return { x: a, y: s };
}

/** 星区中心（银河坐标，y 轴已翻转为屏幕方向）。 */
export function sectorCenter(cluster: Cluster, sector: Sector): Vec2 {
  const off = sectorOffset(cluster, sector);
  return [cluster.pos[0] + off.x, -cluster.pos[1] + off.y];
}

/** 六边形轮廓点串。expand 用于 Kha'ak 描边。 */
export function hexPoints(cluster: Cluster, sector?: Sector, expand = false): string {
  let cx = cluster.pos[0];
  let cy = -cluster.pos[1];
  if (sector && cluster.sectors.length > 1) {
    const off = sectorOffset(cluster, sector);
    cx += off.x;
    cy += off.y;
  }
  const factor = sector ? (cluster.sectors.length > 1 ? 2 : 1) : 1;
  let o = CELL_W / factor;
  let c = CELL_H / factor;
  if (expand) {
    o += 50;
    c += 100;
  }
  const pts: Array<[number, number]> = [
    [cx - o, cy - c],
    [cx + o, cy - c],
    [cx + 2 * o, cy],
    [cx + o, cy + c],
    [cx - o, cy + c],
    [cx - 2 * o, cy],
    [cx - o, cy - c],
  ];
  return pts.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

/** 星区名标签的总宽度（中文按全角计）。 */
export function labelWidth(name: string, fontSize = 1000) {
  let units = 0;
  for (const ch of name) {
    if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) units += 1;
    else if (/[iljt'.,:;!|]/.test(ch)) units += 0.3;
    else if (ch === " ") units += 0.3;
    else units += 0.58;
  }
  return units * fontSize + 620;
}

/** 标签相对星区中心的 y 偏移。 */
export function labelOffsetY(sectorCount: number) {
  return [6500, 2200, 2200][sectorCount - 1] ?? 6500;
}
