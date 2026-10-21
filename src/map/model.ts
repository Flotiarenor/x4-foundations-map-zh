import type { Cluster, Galaxy, Sector, Vec2 } from "../types";
import { innerScale, sectorCenter } from "./geometry";

export interface GateDot {
  key: string;
  pos: Vec2;
  ref: string;
  dlc: string;
}

export interface RouteLine {
  from: Vec2;
  to: Vec2;
  highway: boolean;
  dlc: string;
}

export interface MapModel {
  gates: GateDot[];
  lines: RouteLine[];
  clusterByMacro: Map<string, Cluster>;
  neighbours: Map<string, string[]>;
  sectorByMacro: Map<string, { cluster: Cluster; sector: Sector }>;
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function buildModel(galaxy: Galaxy): MapModel {
  const gateMap = new Map<string, GateDot>();
  const lines: RouteLine[] = [];
  const clusterByMacro = new Map<string, Cluster>();
  const sectorByMacro = new Map<string, { cluster: Cluster; sector: Sector }>();

  for (const cluster of galaxy.clusters) {
    clusterByMacro.set(cluster.macro.toLowerCase(), cluster);
    const scale = innerScale(cluster.sectors.length);

    for (const sector of cluster.sectors) {
      sectorByMacro.set(sector.macro.toLowerCase(), { cluster, sector });
      const [scx, scy] = sectorCenter(cluster, sector);
      for (const zone of sector.zones) {
        const zx = scx + zone.pos[0] * scale.x;
        const zy = scy - zone.pos[1] * scale.y;
        for (const item of zone.items) {
          const ref = item.ref ?? "";
          if (ref !== "gates" && !ref.includes("SHCon")) continue;
          const key = (item.name ?? `${cluster.name}_${ref}`)
            .toLowerCase()
            .replace("601b", "601");
          if (gateMap.has(key)) continue;
          gateMap.set(key, {
            key,
            pos: [zx + item.pos[0] * scale.x, zy - item.pos[1] * scale.y],
            ref,
            dlc: sector.dlc,
          });
        }
      }
    }

    // 星区高速：入口/出口是同一星区群内的星门区
    for (const hw of cluster.highways) {
      let entry: Vec2 | null = null;
      let exit: Vec2 | null = null;
      for (const conn of hw.connections) {
        if (conn.ref !== "entrypoint" && conn.ref !== "exitpoint") continue;
        for (const sector of cluster.sectors) {
          const zone = sector.zones.find(
            (z) => z.macro?.toLowerCase() === conn.macro.toLowerCase(),
          );
          if (!zone) continue;
          const [scx, scy] = sectorCenter(cluster, sector);
          const pos: Vec2 = [
            scx + zone.pos[0] * scale.x,
            scy - zone.pos[1] * scale.y,
          ];
          if (conn.ref === "entrypoint") entry = pos;
          else exit = pos;
        }
      }
      if (entry && exit) {
        lines.push({ from: entry, to: exit, highway: true, dlc: cluster.dlc });
      }
    }
  }

  const neighbours = new Map<string, string[]>();
  const seenPairs = new Set<string>();
  for (const key of gateMap.keys()) {
    const stripped = key.replace("connection_clustergate", "");
    const [s, o] = stripped.split("to");
    if (!s || !o) continue;
    const pairKey = [s, o].sort().join("_");
    if (seenPairs.has(pairKey)) continue;
    const forward = gateMap.get(`connection_clustergate${s}to${o}`);
    const back = gateMap.get(`connection_clustergate${o}to${s}`);
    if (!forward || !back) continue;
    seenPairs.add(pairKey);
    const dlc = forward.dlc !== "base" ? forward.dlc : back.dlc;
    lines.push({ from: forward.pos, to: back.pos, highway: false, dlc });

    const a = `cluster_${pad(parseInt(s, 10))}_macro`;
    const b = `cluster_${pad(parseInt(o, 10))}_macro`;
    if (!neighbours.has(a)) neighbours.set(a, []);
    if (!neighbours.has(b)) neighbours.set(b, []);
    neighbours.get(a)!.push(b);
    neighbours.get(b)!.push(a);
  }

  return {
    gates: [...gateMap.values()],
    lines,
    clusterByMacro,
    neighbours,
    sectorByMacro,
  };
}

/** 从某个星区出发，沿星门走 maxJumps 跳能到达的星区群。 */
export function clustersInRange(model: MapModel, start: Cluster, maxJumps: number): Set<string> {
  const result = new Set<string>();
  if (maxJumps <= 0) return result;
  const key = start.macro.toLowerCase();
  const seen = new Set<string>([key]);
  let frontier = [key];
  for (let i = 0; i < maxJumps; i++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const nb of model.neighbours.get(cur) ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        next.push(nb);
        const cluster = model.clusterByMacro.get(nb);
        if (cluster) result.add(cluster.macro);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return result;
}
