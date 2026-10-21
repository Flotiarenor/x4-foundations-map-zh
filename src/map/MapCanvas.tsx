import { useEffect, useMemo, useRef } from "react";
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

const VIEWBOX = "-280000 -190000 500000 330000";
const ZOOM_MIN = 1;
const ZOOM_MAX = 12;

export interface HoverInfo {
  sector: Sector;
  cluster: Cluster;
  clientX: number;
  clientY: number;
}

interface Props {
  galaxy: Galaxy;
  model: MapModel;
  settings: Settings;
  zoom: number;
  pan: { x: number; y: number };
  focusSector: string | null;
  focusRange: number;
  ratesBySector: Map<string, Record<string, number>>;
  onHover: (info: HoverInfo | null) => void;
  onPick: (info: HoverInfo | null) => void;
  onZoom: (z: number) => void;
  onPan: (p: { x: number; y: number }) => void;
}

export function MapCanvas({
  galaxy,
  model,
  settings,
  zoom,
  pan,
  focusSector,
  focusRange,
  ratesBySector,
  onHover,
  onPick,
  onZoom,
  onPan,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const moved = useRef(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = zoomRef.current;
      if (e.deltaY < 0 && z >= ZOOM_MAX) return;
      if (e.deltaY > 0 && z <= ZOOM_MIN) return;
      const next = e.deltaY < 0 ? Math.min(z + 0.8, ZOOM_MAX) : Math.max(z - 0.8, ZOOM_MIN);
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const p = panRef.current;
      const k = 1 / next - 1 / z;
      onPan({ x: p.x + sx * k, y: p.y + sy * k });
      onZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoom, onPan]);

  const clusters = useMemo(
    () => galaxy.clusters.filter((c) => settings.dlcs[c.dlc]),
    [galaxy, settings.dlcs],
  );

  const sectorIndex = useMemo(() => {
    const m = new Map<string, { sector: Sector; cluster: Cluster }>();
    for (const c of clusters) {
      for (const s of c.sectors) m.set(s.name, { sector: s, cluster: c });
    }
    return m;
  }, [clusters]);

  const lines = useMemo(
    () => model.lines.filter((l) => settings.dlcs[l.dlc]),
    [model.lines, settings.dlcs],
  );

  const gates = useMemo(
    () => model.gates.filter((g) => settings.dlcs[g.dlc]),
    [model.gates, settings.dlcs],
  );

  const inRange = useMemo(() => {
    const set = new Set<string>();
    if (!focusSector || focusRange <= 0) return set;
    const entry = model.sectorByMacro.get(focusSector.toLowerCase());
    if (!entry) return set;
    const key = entry.cluster.macro.toLowerCase();
    const seen = new Set([key]);
    let frontier = [key];
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

  const selectedSector = focusSector
    ? model.sectorByMacro.get(focusSector.toLowerCase())?.sector ?? null
    : null;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    moved.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onHover(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
    onPan({
      x: d.px + dx / zoom,
      y: d.py + dy / zoom,
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    const wasDrag = moved.current;
    drag.current = null;
    if (wasDrag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const holder = el?.closest("[data-sector]");
    const name = holder?.getAttribute("data-sector");
    if (!name) {
      onPick(null);
      return;
    }
    const found = sectorIndex.get(name);
    if (found) {
      onPick({
        sector: found.sector,
        cluster: found.cluster,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
  };

  return (
    <svg
      ref={svgRef}
      className="map-svg"
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        drag.current = null;
      }}
    >
      <rect
        x={-280000}
        y={-190000}
        width={500000}
        height={330000}
        fill="black"
      />

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
            onMouseEnter={(e) =>
              onHover({ sector: s, cluster: c, clientX: e.clientX, clientY: e.clientY })
            }
            onMouseMove={(e) =>
              onHover({ sector: s, cluster: c, clientX: e.clientX, clientY: e.clientY })
            }
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
                opacity={1}
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

      {selectedSector && (
        <polyline
          points={hexPoints(
            model.sectorByMacro.get(selectedSector.macro.toLowerCase())!.cluster,
            selectedSector,
          )}
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
                    {letter && (
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
          const w = labelWidth(s.zh);
          const y = cy - labelOffsetY(c.sectors.length) - 950;
          return (
            <g key={`label-${s.name}`} style={{ pointerEvents: "none" }}>
              <rect
                x={cx - w / 2}
                y={y}
                width={w}
                height={1200}
                rx={80}
                fill="black"
                stroke={factionColor(galaxy, s.owner)}
                strokeWidth={75}
                opacity={0.75}
              />
              <text
                x={cx}
                y={y + 900}
                fontSize={1000}
                textAnchor="middle"
                fill="white"
                fontFamily="'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif"
              >
                {s.zh}
              </text>
            </g>
          );
        }),
      )}

      {settings.showResources &&
        clusters.map((c) =>
          c.sectors.map((s) => {
            const rates = ratesBySector.get(s.name);
            if (!rates) return null;
            const [cx, cy] = sectorCenter(c, s);
            const multi = c.sectors.length > 1;
            const JN = 4950;
            const slots: Array<[string, number, number, number, number]> = multi
              ? [
                  ["ore", JN - 6800, 2820, 1100, 800],
                  ["silicon", JN - 5600, 2820, 1100, 800],
                  ["ice", JN - 4400, 2820, 1100, 800],
                  ["nividium", JN - 3150, 2820, 1100, 800],
                  ["hydrogen", JN - 6800, 3720, 1100, 800],
                  ["helium", JN - 5600, 3720, 1100, 800],
                  ["methane", JN - 4400, 3720, 1100, 800],
                  ["rawscrap", JN - 3150, 3720, 1100, 800],
                  ["sun", JN - 3400, -3680, 1800, 800],
                ]
              : [
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
            return (
              <g key={`res-${s.name}`} style={{ pointerEvents: "none" }}>
                {slots.map(([id, dx, dy, w, h]) => {
                  const value =
                    id === "sun"
                      ? Math.round((s.sunlight ?? 0) * 100)
                      : rates[id] ?? 0;
                  if (!value) return null;
                  const color = RESOURCE_COLOR[id];
                  return (
                    <g key={id}>
                      <rect
                        x={cx + dx - w / 2}
                        y={cy + dy - h / 2}
                        width={w}
                        height={h}
                        rx={200}
                        fill={color}
                        stroke={color}
                        strokeWidth={50}
                        opacity={0.8}
                      />
                      <text
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
                    </g>
                  );
                })}
              </g>
            );
          }),
        )}
    </svg>
  );
}

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
