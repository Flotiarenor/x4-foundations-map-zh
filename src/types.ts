export type Vec2 = [number, number];

export interface Faction {
  id: string;
  name: string;
  zh: string;
  short: string;
  color: string;
  dlc?: string;
}

export interface Station {
  id: string;
  owner: string;
  type: string;
  tags: string[];
  pos: Vec2;
  offset: Vec2;
  location: { class?: string; macro?: string };
}

export interface ZoneItem {
  ref?: string;
  name?: string;
  pos: Vec2;
}

export interface Zone {
  ref: string;
  macro: string;
  pos: Vec2;
  items: ZoneItem[];
  stations: Station[];
}

export interface Sector {
  name: string;
  macro: string;
  zh: string;
  owner?: string | null;
  dlc: string;
  pos: Vec2;
  sunlight?: number | null;
  khaakHive: boolean;
  khaakActivity: string[];
  regions: string[];
  stations: Station[];
  zones: Zone[];
}

export interface Highway {
  dlc: string;
  connections: { ref: string; macro: string }[];
}

export interface Cluster {
  name: string;
  macro: string;
  zh: string;
  owner?: string | null;
  dlc: string;
  pos: Vec2;
  sectors: Sector[];
  highways: Highway[];
}

export interface Region {
  dlc: string;
  volume: number;
  replenish: Record<string, number>;
}

export interface Galaxy {
  version: string;
  clusters: Cluster[];
  regions: Record<string, Region>;
  factions: Record<string, Faction>;
}

export interface Settings {
  showTooltip: boolean;
  showStations: boolean;
  showResources: boolean;
  showKhaakHive: boolean;
  showKhaakActivity: boolean;
  dlcs: Record<string, boolean>;
}
