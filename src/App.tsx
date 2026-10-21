import { useMemo, useState } from "react";
import galaxyJson from "./data/galaxy.json";
import type { Galaxy, Settings } from "./types";
import { buildModel } from "./map/model";
import { MapCanvas, type HoverInfo } from "./map/MapCanvas";
import { factionName, sectorRates } from "./map/resources";
import {
  DLC_LIST,
  RESOURCES,
  RESOURCE_COLOR,
  RESOURCE_LABEL,
  UI,
  qualityLabel,
} from "./i18n";

const galaxy = galaxyJson as unknown as Galaxy;
const model = buildModel(galaxy);

const defaultSettings = (): Settings => ({
  showTooltip: true,
  showStations: true,
  showResources: true,
  showKhaakHive: false,
  showKhaakActivity: false,
  dlcs: Object.fromEntries(DLC_LIST.map((d) => [d.id, true])),
});

const focusOptions = galaxy.clusters
  .flatMap((c) => c.sectors.map((s) => ({ value: s.macro, label: s.zh })))
  .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));

function initialView() {
  const w = window.innerWidth;
  const z = w < 640 ? 2.4 : 1;
  if (z === 1) return { zoom: 1, pan: { x: 0, y: 0 } };
  const h = window.innerHeight - (w <= 820 ? 52 : 74);
  return { zoom: z, pan: { x: (w * (1 - z)) / (2 * z), y: (h * (1 - z)) / (2 * z) } };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [zoom, setZoom] = useState(() => initialView().zoom);
  const [pan, setPan] = useState(() => initialView().pan);
  const [focus, setFocus] = useState<string>("none");
  const [range, setRange] = useState(2);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [pinned, setPinned] = useState<HoverInfo | null>(null);
  const tip = pinned ?? hover;

  const ratesBySector = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const cluster of galaxy.clusters) {
      for (const sector of cluster.sectors) {
        map.set(sector.name, sectorRates(galaxy, sector));
      }
    }
    return map;
  }, []);

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const toggleDlc = (id: string) =>
    setSettings((s) => ({ ...s, dlcs: { ...s.dlcs, [id]: !s.dlcs[id] } }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-main">{UI.title}</span>
          <span className="brand-sub">{UI.subtitle}</span>
        </div>
        <div className="hint">{UI.hud}</div>
      </header>

      <div className="map-shell">
        <MapCanvas
          galaxy={galaxy}
          model={model}
          settings={settings}
          zoom={zoom}
          pan={pan}
          focusSector={focus === "none" ? null : focus}
          focusRange={range}
          ratesBySector={ratesBySector}
          onHover={setHover}
          onPick={(info) => {
            setPinned((cur) =>
              info && cur?.sector.name === info.sector.name ? null : info,
            );
          }}
          onZoom={setZoom}
          onPan={setPan}
        />

        <div className="panel focus-panel">
          <select
            className="select"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            aria-label={UI.focusPlaceholder}
          >
            <option value="none">{UI.noFocus}</option>
            {focusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {focus !== "none" && (
            <select
              className="select select--range"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              aria-label="跳数"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {UI.jumps(n)}
                </option>
              ))}
            </select>
          )}
        </div>

        {settings.showResources && (
          <div className="panel legend">
            <div className="panel-title">{UI.legend}</div>
            <div className="legend-grid">
              {RESOURCES.map((id) => (
                <span
                  key={id}
                  className="legend-item"
                  style={{ background: RESOURCE_COLOR[id] }}
                >
                  {RESOURCE_LABEL[id]}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="panel settings">
          <div className="panel-title">{UI.settings}</div>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showTooltip}
              onChange={() => set({ showTooltip: !settings.showTooltip })}
            />
            <span>{UI.showTooltip}</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showStations}
              onChange={() => set({ showStations: !settings.showStations })}
            />
            <span>{UI.stations}</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showResources}
              onChange={() => set({ showResources: !settings.showResources })}
            />
            <span>{UI.resources}</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showKhaakHive}
              onChange={() => set({ showKhaakHive: !settings.showKhaakHive })}
            />
            <span>{UI.khaakHive}</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showKhaakActivity}
              onChange={() => set({ showKhaakActivity: !settings.showKhaakActivity })}
            />
            <span>{UI.khaakActivity}</span>
          </label>

          <div className="panel-title panel-title--gap">{UI.dlcs}</div>
          {DLC_LIST.map((d) => (
            <label className="check" key={d.id}>
              <input
                type="checkbox"
                checked={settings.dlcs[d.id]}
                onChange={() => toggleDlc(d.id)}
              />
              <span>{d.zh}</span>
            </label>
          ))}
        </div>

        <div className="zoom">
          <input
            type="range"
            min={1}
            max={12}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="缩放"
          />
          <button
            type="button"
            className="zoom-reset"
            onClick={() => {
              const v = initialView();
              setZoom(v.zoom);
              setPan(v.pan);
            }}
          >
            复位
          </button>
        </div>

        {tip && settings.showTooltip && (
          <TooltipCard info={tip} zoom={zoom} />
        )}
      </div>

      <footer className="footer">
        数据来自 X4: Foundations 8.0 游戏文件 · 星图整理参考 Quantum Anomaly · 仅供个人查阅
      </footer>
    </div>
  );
}

function TooltipCard({ info }: { info: HoverInfo; zoom: number }) {
  const { sector, cluster, clientX, clientY } = info;
  const rates = sectorRates(galaxy, sector);
  const left = Math.min(clientX + 18, window.innerWidth - 320);
  const top = Math.min(clientY + 18, window.innerHeight - 260);
  const khaak = sector.khaakActivity
    .map((ref) => model.sectorByMacro.get(ref.toLowerCase())?.sector.zh)
    .filter(Boolean);

  return (
    <div
      className="tooltip"
      style={{ left, top }}
      onMouseEnter={() => undefined}
    >
      <div className="tooltip-name">{sector.zh}</div>
      <div className="tooltip-owner">{factionName(galaxy, sector.owner)}</div>
      <div className="tooltip-sep" />
      <div className="tooltip-row">
        <span className="muted">{UI.sunlight}</span>
        <span>
          {Math.round((sector.sunlight ?? 0) * 100)}%
          <i className="dot" style={{ background: RESOURCE_COLOR.sun }} />
        </span>
      </div>
      {RESOURCES.filter((id) => rates[id] > 0).map((id) => (
        <div className="tooltip-row" key={id}>
          <span className="muted">{RESOURCE_LABEL[id]}</span>
          <span>
            <em>{qualityLabel(rates[id])}</em>
            <b>{rates[id].toLocaleString("zh-CN")}</b>
            <i className="dot" style={{ background: RESOURCE_COLOR[id] }} />
          </span>
        </div>
      ))}
      {sector.khaakHive && (
        <div className="tooltip-row">
          <span className="muted">Kha'ak 巢穴</span>
          <span>可能</span>
        </div>
      )}
      <div className="tooltip-row">
        <span className="muted">{UI.khaakSources}</span>
        <span className={khaak.length ? "" : "muted"}>
          {khaak.length ? khaak.join("、") : UI.khaakFree}
        </span>
      </div>
    </div>
  );
}

export { galaxy };
