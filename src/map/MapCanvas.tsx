import { memo, useEffect, useMemo, useRef } from "react";
import type { Cluster, Galaxy, Sector, Settings, Station } from "../types";
import type { MapModel } from "./model";
import {
  hexPoints,
  innerScale,
  labelOffsetY,
  labelWidth,
  sectorCenter,
} from "./geometry";
import { factionColor } from "./resources";
import { RESOURCE_COLOR } from "../i18n";

export const BASE_W = 500000;
export const BASE_H = 330000;
export const BASE_CX = -30000;
export const BASE_CY = -25000;

const ZOOM_MIN = 1;
const ZOOM_MAX = 12;
const ZOOM_STEP = 1.15;

export interface MapView {
  zoom: number;
  cx: number;
  cy: number;
}

export interface HoverInfo {
  sector: Sector;
  cluster: Cluster;
  clientX: number;
  clientY: number;
}

export const initialView = (): MapView => {
  const small = typeof window !== "undefined" && window.innerWidth < 640;
  return { zoom: small ? 2.4 : 1, cx: BASE_CX, cy: BASE_CY };
};

interface Props {
  galaxy: Galaxy;
  model: MapModel;
  settings: Settings;
  view: MapView;
  focusSector: string | null;
  focusRange: number;
  ratesBySector: Map<string, Record<string, number>>;
  onHover: (info: HoverInfo | null) => void;
  onPick: (info: HoverInfo | null) => void;
  onView: (v: MapView) => void;
}

export function MapCanvas({
  galaxy,
  model,
  settings,
  view,
  focusSector,
  focusRange,
  ratesBySector,
  onHover,
  onPick,
  onView,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);

  const w = BASE_W / view.zoom;
  const h = BASE_H / view.zoom;
  const vx = view.cx - w / 2;
  const vy = view.cy - h / 2;

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.deltaY < 0 && v.zoom >= ZOOM_MAX) return;
      if (e.deltaY > 0 && v.zoom <= ZOOM_MIN) return;
      const zoom = e.deltaY < 0 ? Math.min(v.zoom * ZOOM_STEP, ZOOM_MAX) : Math.max(v.zoom / ZOOM_STEP, ZOOM_MIN);

      const rect = el.getBoundingClientRect();
      const w1 = BASE_W / v.zoom;
      const h1 = BASE_H / v.zoom;
      const s1 = Math.min(rect.width / w1, rect.height / h1);
      const ox1 = (rect.width - w1 * s1) / 2;
      const oy1 = (rect.height - h1 * s1) / 2;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // 光标下的世界坐标
      const wx = v.cx - w1 / 2 + (sx - ox1) / s1;
      const wy = v.cy - h1 / 2 + (sy - oy1) / s1;

      const w2 = BASE_W / zoom;
      const h2 = BASE_H / zoom;
      const s2 = Math.min(rect.width / w2, rect.height / h2);
      const ox2 = (rect.width - w2 * s2) / 2;
      const oy2 = (rect.height - h2 * s2) / 2;
      const nx = wx - (sx - ox2) / s2 + w2 / 2;
      const ny = wy - (sy - oy2) / s2 + h2 / 2;
      const nextView = { zoom, cx: nx, cy: ny };
      // 立刻更新 ref，保证连续滚轮事件基于最新状态累加
      viewRef.current = nextView;
      onView(nextView);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onView]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    moved.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onHover(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    let scale: number;
    if (e.buttons === 0) return; // 拖动已结束，避免残留
    scale = Math.min(rect.width / w, rect.height / h);
    onView({ ...view, cx: d.cx - dx / scale, cy: d.cy - dy / scale });
  };

  const endDrag = (e: React.PointerEvent) => {
    const wasDrag = moved.current;
    drag.current = null;
    if (wasDrag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const name = el?.closest("[data-sector]")?.getAttribute("data-sector");
    if (!name) {
      onPick(null);
      return;
    }
    const found = sectorIndexRef.current.get(name);
    if (found) {
      onPick({
        sector: found.sector,
        cluster: found.cluster,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
  };

  const sectorIndexRef = useRef(new Map<string, { sector: Sector; cluster: Cluster }>());
  sectorIndexRef.current = useMemo(() => {
    const m = new Map<string, { sector: Sector; cluster: Cluster }>();
    for (const c of galaxy.clusters) for (const s of c.sectors) m.set(s.name, { sector: s, cluster: c });
    return m;
  }, [galaxy]);

  return (
    <svg
      ref={svgRef}
      className="map-svg"
      viewBox={`${vx} ${vy} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        drag.current = null;
      }}
    >
      <rect x={-280000} y={-190000} width={500000} height={330000} fill="black" />
      <MapLayers
        galaxy={galaxy}
        model={model}
        settings={settings}
        focusSector={focusSector}
        focusRange={focusRange}
        ratesBySector={ratesBySector}
        bounds={{ x: vx, y: vy, w, h }}
        onHover={onHover}
        onPick={onPick}
      />
    </svg>
  );
}

const JN = 4950;

type Slot = [string, number, number, number, number];

const SLOTS_MULTI: Slot[] = [
  ["ore", JN - 6800, 2820, 1100, 800],
  ["silicon", JN - 5600, 2820, 1100, 800],
  ["ice", JN - 4400, 2820, 1100, 800],
  ["nividium", JN - 3150, 2820, 1100, 800],
  ["hydrogen", JN - 6800, 3720, 1100, 800],
  ["helium", JN - 5600, 3720, 1100, 800],
  ["methane", JN - 4400, 3720, 1100, 800],
  ["rawscrap", JN - 3150, 3720, 1100, 800],
  ["sun", JN - 3400, -3680, 1800, 800],
];

const SLOTS_SINGLE: Slot[] = [
  ["ore", JN - 9000, 7020, 1100, 800],
  ["silicon", JN - 7800, 7020, 1100, 800],
  ["ice", JN - 6600, 7020, 1100, 800],
  ["nividium", JN - 1000, 7020, 1100, 800],
  ["hydrogen", JN - 9000, 7920, 1100, 800],
  ["helium", JN - 7800, 7920, 1100, 800],
  ["methane", JN - 6600, 7920, 1100, 800],
  ["rawscrap", JN - 1000, 7920, 1100, 800],
  ["sun", JN - 1000, -7980, 1800, 800],
];

interface LayersProps {
  galaxy: Galaxy;
  model: MapModel;
  settings: Settings;
  focusSector: string | null;
  focusRange: number;
  ratesBySector: Map<string, Record<string, number>>;
  bounds: { x: number; y: number; w: number; h: number };
  onHover: (info: HoverInfo | null) => void;
  onPick: (info: HoverInfo | null) => void;
}

const MARGIN_X = 14000;
const MARGIN_TOP = 16000;
const MARGIN_BOTTOM = 12000;

function clusterInView(c: Cluster, b: LayersProps["bounds"]) {
  const cx = c.pos[0];
  const cy = -c.pos[1];
  return !(
    cx + MARGIN_X < b.x ||
    cx - MARGIN_X > b.x + b.w ||
    cy + MARGIN_BOTTOM < b.y ||
    cy - MARGIN_TOP > b.y + b.h
  );
}

function pointInView(p: [number, number], b: LayersProps["bounds"], pad = 600) {
  return (
    p[0] > b.x - pad &&
    p[0] < b.x + b.w + pad &&
    p[1] > b.y - pad &&
    p[1] < b.y + b.h + pad
  );
}

function lineInView(from: [number, number], to: [number, number], b: LayersProps["bounds"]) {
  const minX = Math.min(from[0], to[0]) - 600;
  const maxX = Math.max(from[0], to[0]) + 600;
  const minY = Math.min(from[1], to[1]) - 600;
  const maxY = Math.max(from[1], to[1]) + 600;
  return !(maxX < b.x || minX > b.x + b.w || maxY < b.y || minY > b.y + b.h);
}

const MapLayers = memo(function MapLayers({
  galaxy,
  model,
  settings,
  focusSector,
  focusRange,
  ratesBySector,
  bounds,
  onHover,
}: LayersProps) {
  const allClusters = useMemo(
    () => galaxy.clusters.filter((c) => settings.dlcs[c.dlc]),
    [galaxy, settings.dlcs],
  );

  const clusters = useMemo(
    () => allClusters.filter((c) => clusterInView(c, bounds)),
    [allClusters, bounds],
  );

  // 缩小时不画文字数字，省掉上千个文本节点，缩放才跟手
  const compact = bounds.w > BASE_W / 2.2;

  // 所有资源色块合并成 8 条 path，避免上千个 rect 拖慢缩放
  const chips = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const c of clusters) {
      for (const s of c.sectors) {
        const rates = ratesBySector.get(s.name);
        if (!rates) continue;
        const [cx, cy] = sectorCenter(c, s);
        const slots = c.sectors.length > 1 ? SLOTS_MULTI : SLOTS_SINGLE;
        for (const [id, dx, dy, w, h2] of slots) {
          const value =
            id === "sun" ? Math.round((s.sunlight ?? 0) * 100) : rates[id] ?? 0;
          if (!value) continue;
          const x = Math.round(cx + dx - w / 2);
          const y = Math.round(cy + dy - h2 / 2);
          (acc[id] ??= []).push(`M${x},${y}h${w}v${h2}h${-w}z`);
        }
      }
    }
    return acc;
  }, [clusters, ratesBySector]);

  const lines = useMemo(
    () =>
      model.lines.filter(
        (l) => settings.dlcs[l.dlc] && lineInView(l.from, l.to, bounds),
      ),
    [model.lines, settings.dlcs, bounds],
  );

  const gates = useMemo(
    () =>
      model.gates.filter(
        (g) => settings.dlcs[g.dlc] && pointInView(g.pos, bounds),
      ),
    [model.gates, settings.dlcs, bounds],
  );

  const inRange = useMemo(() => {
    const set = new Set<string>();
    if (!focusSector || focusRange <= 0) return set;
    const entry = model.sectorByMacro.get(focusSector.toLowerCase());
    if (!entry) return set;
    const start = entry.cluster.macro.toLowerCase();
    const seen = new Set([start]);
    let frontier = [start];
    for (let i = 0; i < focusRange; i++) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const nb of model.neighbours.get(cur) ?? []) {
          if (seen.has(nb)) continue;
          seen.add(nb);
          next.push(nb);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    seen.forEach((id) => set.add(id));
    return set;
  }, [focusSector, focusRange, model]);

  const selected = focusSector
    ? model.sectorByMacro.get(focusSector.toLowerCase()) ?? null
    : null;

  const handleEnter = (e: React.MouseEvent, s: Sector, c: Cluster) =>
    onHover({ sector: s, cluster: c, clientX: e.clientX, clientY: e.clientY });

  return (
    <>
      {clusters
        .filter((c) => c.sectors.length > 1)
        .map((c) => (
          <polyline
            key={`bg-${c.name}`}
            points={hexPoints(c)}
            fill="gray"
            fillOpacity={0.1}
            stroke={factionColor(galaxy, c.owner)}
            strokeWidth={200}
            style={{ pointerEvents: "none" }}
          />
        ))}

      {clusters.map((c) =>
        c.sectors.map((s) => (
          <polyline
            key={s.name}
            data-sector={s.name}
            points={hexPoints(c, s)}
            fill={factionColor(galaxy, s.owner)}
            fillOpacity={0.1}
            stroke={factionColor(galaxy, s.owner)}
            strokeWidth={200}
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) => handleEnter(e, s, c)}
            onMouseMove={(e) => handleEnter(e, s, c)}
            onMouseLeave={() => onHover(null)}
          />
        )),
      )}

      {settings.showKhaakHive &&
        clusters.map((c) =>
          c.sectors
            .filter((s) => s.khaakHive)
            .map((s) => (
              <polyline
                key={`hive-${s.name}`}
                points={hexPoints(c, s, true)}
                fill={factionColor(galaxy, "khaak")}
                stroke={factionColor(galaxy, "khaak")}
                strokeWidth={1000}
                style={{ pointerEvents: "none" }}
              />
            )),
        )}

      {settings.showKhaakActivity &&
        clusters.map((c) =>
          c.sectors
            .filter((s) => s.khaakActivity.length > 0)
            .map((s) => (
              <polyline
                key={`act-${s.name}`}
                points={hexPoints(c, s, true)}
                fill="transparent"
                stroke={factionColor(galaxy, "khaak")}
                strokeWidth={800}
                style={{ pointerEvents: "none" }}
              />
            )),
        )}

      {clusters
        .filter((c) => inRange.has(c.macro.toLowerCase()))
        .map((c) => (
          <polyline
            key={`focus-${c.name}`}
            points={hexPoints(c)}
            fill="#004752"
            fillOpacity={0.7}
            stroke="#10f762"
            strokeWidth={600}
            style={{ pointerEvents: "none" }}
          />
        ))}

      {selected && (
        <polyline
          points={hexPoints(selected.cluster, selected.sector)}
          fill="#004752"
          stroke="#10f762"
          strokeWidth={1200}
          style={{ pointerEvents: "none" }}
        />
      )}

      {gates.map((g) => (
        <circle
          key={g.key}
          cx={g.pos[0]}
          cy={g.pos[1]}
          r={g.ref === "gates" ? 300 : 100}
          fill={g.ref === "gates" ? "gray" : "blue"}
          stroke="white"
          strokeWidth={30}
          style={{ pointerEvents: "none" }}
        />
      ))}

      {lines.map((l, i) => (
        <g key={`line-${i}`}>
          <line
            x1={l.from[0]}
            y1={l.from[1]}
            x2={l.to[0]}
            y2={l.to[1]}
            stroke={l.highway ? "white" : "black"}
            strokeWidth={l.highway ? 100 : 300}
          />
          <line
            x1={l.from[0]}
            y1={l.from[1]}
            x2={l.to[0]}
            y2={l.to[1]}
            stroke={l.highway ? "blue" : "white"}
            strokeWidth={l.highway ? 75 : 150}
            strokeDasharray={l.highway ? "100 50" : "80 50"}
          />
        </g>
      ))}

      {settings.showStations &&
        clusters.map((c) =>
          c.sectors.flatMap((s) =>
            [...s.stations, ...s.zones.flatMap((z) => z.stations)]
              .filter(isNotableStation)
              .map((st) => {
                const [x, y] = stationPos(c, s, st);
                const color = factionColor(galaxy, st.owner);
                const letter = stationLetter(st);
                return (
                  <g
                    key={`${s.name}-${st.id}`}
                    transform={`translate(${x - 5.5 * 150}, ${y - 5.5 * 150}) scale(150)`}
                    style={{ pointerEvents: "none" }}
                  >
                    <polygon
                      points="5,1 11,1 14.5,7 11,13 5,13 1.5,7"
                      fill="#050505"
                      stroke={color}
                      strokeWidth={0.8}
                      opacity={0.95}
                    />
                    {letter && !compact && (
                      <text
                        x={8}
                        y={10}
                        fontSize={6.2}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontFamily="sans-serif"
                        fontWeight="bold"
                      >
                        {letter}
                      </text>
                    )}
                  </g>
                );
              }),
          ),
        )}

      {clusters.map((c) =>
        c.sectors.map((s) => {
          const [cx, cy] = sectorCenter(c, s);
          const both = settings.nameMode === "both" && !!s.en;
          const text = both ? `${s.en}｜${s.zh}` : s.zh;
          const fontSize = both ? 820 : 1000;
          const wl = labelWidth(text, fontSize);
          const y = cy - labelOffsetY(c.sectors.length) - 950;
          return (
            <g key={`label-${s.name}`} style={{ pointerEvents: "none" }}>
              <rect
                x={cx - wl / 2}
                y={y}
                width={wl}
                height={both ? 1350 : 1200}
                rx={80}
                fill="black"
                stroke={factionColor(galaxy, s.owner)}
                strokeWidth={75}
                opacity={0.75}
              />
              <text
                x={cx}
                y={y + (both ? 1010 : 900)}
                fontSize={fontSize}
                textAnchor="middle"
                fill="white"
                fontFamily="'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
              >
                {text}
              </text>
            </g>
          );
        }),
      )}

      {settings.showResources && (
        <>
          {Object.entries(chips).map(([id, parts]) => (
            <path
              key={`chip-${id}`}
              d={parts.join("")}
              fill={RESOURCE_COLOR[id]}
              opacity={0.8}
              style={{ pointerEvents: "none" }}
            />
          ))}
          {!compact &&
            clusters.map((c) =>
              c.sectors.map((s) => {
                const rates = ratesBySector.get(s.name);
                if (!rates) return null;
                const [cx, cy] = sectorCenter(c, s);
                const slots = c.sectors.length > 1 ? SLOTS_MULTI : SLOTS_SINGLE;
                return (
                  <g key={`res-${s.name}`} style={{ pointerEvents: "none" }}>
                    {slots.map(([id, dx, dy, , h2]) => {
                      const value =
                        id === "sun" ? Math.round((s.sunlight ?? 0) * 100) : rates[id] ?? 0;
                      if (!value) return null;
                      return (
                        <text
                          key={id}
                          x={cx + dx}
                          y={cy + dy + 250}
                          fontSize={620}
                          textAnchor="middle"
                          fill="black"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {id === "sun" ? `${value}%` : value}
                        </text>
                      );
                    })}
                  </g>
                );
              }),
            )}
        </>
      )}
    </>
  );
});

function stationPos(cluster: Cluster, sector: Sector, st: Station): [number, number] {
  const scale = innerScale(cluster.sectors.length);
  const [cx, cy] = sectorCenter(cluster, sector);
  let x = cx;
  let y = cy;
  if (st.location?.class === "zone") {
    const zone = sector.zones.find(
      (z) => z.macro?.toLowerCase() === st.location.macro?.toLowerCase(),
    );
    if (zone) {
      x += zone.pos[0] * scale.x;
      y -= zone.pos[1] * scale.y;
    }
  }
  x += (st.offset[0] + st.pos[0]) * scale.x;
  y -= (st.offset[1] + st.pos[1]) * scale.y;
  return [x, y];
}

function isNotableStation(st: Station): boolean {
  const tags = st.tags ?? [];
  return (
    tags.includes("tradestation") ||
    tags.includes("equipmentdock") ||
    tags.includes("wharf") ||
    tags.includes("shipyard") ||
    tags.includes("piratebase") ||
    st.type.includes("tradingstation") ||
    st.type.includes("piratebase")
  );
}

function stationLetter(st: Station): string {
  const tags = st.tags ?? [];
  if (tags.includes("shipyard")) return "S";
  if (tags.includes("wharf")) return "W";
  if (tags.includes("equipmentdock")) return "E";
  if (tags.includes("tradestation") || st.type.includes("tradingstation")) return "C";
  if (tags.includes("piratebase") || st.type.includes("piratebase")) return "P";
  return "";
}
