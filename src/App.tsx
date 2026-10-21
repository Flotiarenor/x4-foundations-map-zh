import { useCallback, useMemo, useState } from "react";
import galaxyJson from "./data/galaxy.json";
import type { Galaxy, Settings } from "./types";
import { buildModel } from "./map/model";
import { MapCanvas, initialView, type HoverInfo, type MapView } from "./map/MapCanvas";
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
  nameMode: "zh",
  dlcs: Object.fromEntries(DLC_LIST.map((d) => [d.id, true])),
});

const focusOptions = galaxy.clusters
  .flatMap((c) => c.sectors.map((s) => ({ value: s.macro, label: s.zh })))
  .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));

function initialViewFor() {
  return initialView();
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [view, setView] = useState<MapView>(() => initialViewFor());
  const [focus, setFocus] = useState<string>("none");
  const [range, setRange] = useState(2);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [pinned, setPinned] = useState<HoverInfo | null>(null);
  const tip = pinned ?? hover;

  const handlePick = useCallback((info: HoverInfo | null) => {
    setPinned((cur) => (info && cur?.sector.name === info.sector.name ? null : info));
  }, []);

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
          view={view}
          focusSector={focus === "none" ? null : focus}
          focusRange={range}
          ratesBySector={ratesBySector}
          onHover={setHover}
          onPick={handlePick}
          onView={setView}
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

          <div className="panel-title panel-title--gap">星区名</div>
          <select
            className="select select--full"
            value={settings.nameMode}
            onChange={(e) =>
              set({ nameMode: e.target.value === "both" ? "both" : "zh" })
            }
            aria-label="星区名显示方式"
          >
            <option value="zh">中文</option>
            <option value="both">英文｜中文（游戏原文）</option>
          </select>

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
            value={view.zoom}
            onChange={(e) => setView((v) => ({ ...v, zoom: Number(e.target.value) }))}
            aria-label="缩放"
          />
          <button
            type="button"
            className="zoom-reset"
            onClick={() => setView(initialViewFor())}
          >
            复位
          </button>
        </div>

        {tip && settings.showTooltip && <TooltipCard info={tip} />}
      </div>

      <footer className="footer">
        数据来自 X4: Foundations 8.0 游戏文件 · 星图整理参考 Quantum Anomaly · 仅供个人查阅
      </footer>
    </div>
  );
}

function TooltipCard({ info }: { info: HoverInfo }) {
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
      {sector.en && sector.en !== sector.zh && (
        <div className="tooltip-en">{sector.en}</div>
      )}
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
