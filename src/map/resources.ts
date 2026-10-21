import type { Galaxy, Sector } from "../types";
import { RESOURCES, RESOURCE_DIVISOR, type ResourceId } from "../i18n";

/** 星区资源产出（已按原站规则归一化）。 */
export function sectorRates(galaxy: Galaxy, sector: Sector): Record<ResourceId, number> {
  const out = {} as Record<ResourceId, number>;
  for (const res of RESOURCES) {
    let raw = 0;
    for (const ref of sector.regions) {
      const region = galaxy.regions[ref];
      if (!region) continue;
      const volume = Math.min(region.volume, 3e7);
      raw += (region.replenish[res] ?? 0) * volume;
    }
    const scaled = raw / RESOURCE_DIVISOR[res];
    out[res] = scaled <= 1000 ? Math.ceil(scaled) : 999;
  }
  return out;
}

export function factionColor(galaxy: Galaxy, owner?: string | null): string {
  if (!owner) return "rgba(102, 102, 102, 0.6)";
  return galaxy.factions[owner]?.color ?? "rgba(102, 102, 102, 0.6)";
}

export function factionName(galaxy: Galaxy, owner?: string | null): string {
  if (!owner || owner === "ownerless") return "无主";
  return galaxy.factions[owner]?.zh ?? galaxy.factions[owner]?.name ?? owner;
}
