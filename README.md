# X4：基石 星图 · 中文离线版

X4: Foundations 银河星图的纯静态中文复刻：六边形星区群、星门与星区高速、势力配色、资源产出、Khaak 巢穴、按跳数聚焦，全部离线可用，不依赖任何服务器或第三方接口。

数据取自本机安装的 X4: Foundations 8.0 游戏文件，显示名使用**游戏自带简体中文**（152 个星区里 151 个直接对上官方译名，1 个手工补译）。

## 功能

- **拖动 / 滚轮缩放**：1–12 倍，缩放围绕鼠标位置，按视口裁剪绘制
- **悬停星区**：显示中英文名、所属势力、日照、8 种资源的产出等级与数值、Khaak 活动区域
- **聚焦查询**：选一个星区 + 1–5 跳，沿星门 BFS 高亮可达范围
- **图层开关**：提示框、空间站、资源、Khaak 巢穴、Khaak 活动
- **星区名样式**：纯中文 / 「英文｜中文」游戏原文
- **DLC 过滤**：基础游戏 / 分裂的仇怨 / 人类的摇篮 / 贪婪之潮 / 王国末路 / 时间线 / Hyperion 包 / 特使包
- **图例**：8 种资源配色

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
```

## 构建

```bash
npm run build          # 输出 dist/，用于 GitHub Pages 等静态托管
npm run build:single   # 输出 dist-single/index.html，单文件、双击即开
```

`dist-single/index.html` 把脚本、样式、数据全部内联，约 565 KB，可以直接发给别人双击打开。

## 部署到 GitHub Pages

仓库已附带 `.github/workflows/deploy.yml`：推到 `main` 分支后，在仓库 Settings → Pages 里把 Source 设为 **GitHub Actions**，之后每次 push 自动构建并发布到 `https://<用户>.github.io/<仓库名>/`。

因为构建用的是相对路径（`base: './'`），放在仓库子路径下不需要改任何配置。

## 数据与本地化

- 星区、星门、高速、车站、资源区域来自 Quantum Anomaly 的公开接口快照
- 中文名由 X4 游戏本体 `t/0001-l086.xml` 解析而来，英文对照 `0001-l044.xml`
- 游戏文本用「英文｜中文」并列书写专有名词，站点默认只显示 ｜ 之后的中文；设置里可切回游戏原文写法
- 少量译名（如 `Heretic's End` → 异端的终结）由脚本内的覆盖表补齐

重新生成数据（需要本机安装 X4 与 Python 3）：

```bash
python tools/extract-x4-text.py --game "E:/SteamLibrary/steamapps/common/X4 Foundations" --out _work/x4text
python tools/generate-data.py --work _work/qsna-analysis --text _work/x4text
```

其中 `_work/qsna-analysis/` 需要提前放好 `map.json` 与 `factions.json`（分别对应 `/api/x4/map`、`/api/x4/factions` 的响应）。

## 目录结构

```
src/
  App.tsx              页面外壳、面板、tooltip
  types.ts             数据模型
  i18n.ts              中文文案、资源/DLC 名称
  map/
    geometry.ts        六边形布局（移植自原站算法，已逐点校验）
    model.ts           星门、高速、跳数邻接表
    MapCanvas.tsx      SVG 渲染与指针交互
    resources.ts       资源产出换算、势力颜色
  data/galaxy.json     构建期生成的数据（320 KB）
tools/                 数据生成脚本
```

## 说明

- 几何布局沿用了 Quantum Anomaly 的版式算法，坐标与原站逐点一致，保证星区相对位置不变
- 未做：资源表格视图、数据下载、站点导航
- X4 相关素材版权归 Egosoft GmbH 所有；星图整理参考 Quantum Anomaly。本项目仅供个人查阅使用
