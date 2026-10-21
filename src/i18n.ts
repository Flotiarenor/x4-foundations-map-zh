export const RESOURCES = [
  "ore",
  "silicon",
  "ice",
  "hydrogen",
  "helium",
  "methane",
  "nividium",
  "rawscrap",
] as const;

export type ResourceId = (typeof RESOURCES)[number];

export const RESOURCE_LABEL: Record<ResourceId | "sun", string> = {
  ore: "矿石",
  silicon: "硅",
  ice: "冰",
  hydrogen: "氢",
  helium: "氦",
  methane: "甲烷",
  nividium: "尼维迪姆",
  rawscrap: "废料",
  sun: "日照",
};

export const RESOURCE_COLOR: Record<string, string> = {
  ore: "#ff8c00",
  silicon: "#d4d3cf",
  ice: "#ffffff",
  nividium: "#ab20b1",
  hydrogen: "#c5ffff",
  helium: "#ffeec1",
  methane: "#367ca2",
  rawscrap: "#fc3d39",
  sun: "#ffff00",
};

/** 资源速率换算系数，与原站保持一致。 */
export const RESOURCE_DIVISOR: Record<ResourceId, number> = {
  ore: 100000.05,
  silicon: 100000.05,
  ice: 100000.05,
  rawscrap: 100000.1,
  hydrogen: 25e7,
  helium: 25e7,
  methane: 25e7,
  nividium: 100.1,
};

export const DLC_LIST = [
  { id: "base", zh: "基础游戏" },
  { id: "split", zh: "分裂的仇怨" },
  { id: "terran", zh: "人类的摇篮" },
  { id: "pirate", zh: "贪婪之潮" },
  { id: "boron", zh: "王国末路" },
  { id: "timelines", zh: "时间线" },
  { id: "mini01", zh: "Hyperion 包" },
  { id: "mini02", zh: "特使包" },
] as const;

export const DLC_ZH: Record<string, string> = Object.fromEntries(
  DLC_LIST.map((d) => [d.id, d.zh]),
);

export const UI = {
  title: "X4：基石 星图",
  subtitle: "v8.0 · 中文离线版",
  legend: "图例",
  settings: "设置",
  showTooltip: "显示提示",
  stations: "空间站",
  resources: "资源",
  khaakHive: "Kha'ak 巢穴",
  khaakActivity: "Kha'ak 活动",
  dlcs: "DLC",
  focusPlaceholder: "选择星系…",
  noFocus: "不聚焦",
  jumps: (n: number) => `${n} 跳`,
  sunlight: "日照",
  ownerless: "无主",
  khaakFree: "未发现 Kha'ak",
  khaakSources: "Kha'ak 活动区域",
  hud: "拖动平移 · 滚轮缩放 · 点击查看星区",
} as const;

export function qualityLabel(v: number): string {
  if (v < 10) return "贫瘠";
  if (v < 25) return "低";
  if (v < 250) return "普通";
  if (v < 500) return "高";
  return "极佳";
}
