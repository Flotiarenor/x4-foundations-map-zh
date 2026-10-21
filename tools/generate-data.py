"""把 qsna 接口快照 + X4 官方文本合成为站点使用的 galaxy.json。

用法：
    python tools/generate-data.py --work _work/qsna-analysis --text _work/x4text

--work 目录需包含 map.json（/api/x4/map 的响应）与 factions.json（/api/x4/factions）。
"""

import argparse
import html
import json
import os
import re

REF = re.compile(r"\{(\d+),\s*(\d+)\}(?:\(([^()]*)\))?")
DIRECTIVE = re.compile(r"\((?:speak [^)]*|same as [^)]*|[^()]*sector[^()]*)\)")
CJK = re.compile(r"[\u4e00-\u9fff]")
ROMAN = re.compile(r"^(?:[IVXLC]+|\#\d+[\w]?|\d+)$")

FACTION_ZH = {
    "argon": "Argon 联邦", "antigone": "安提戈涅共和国", "teladi": "Teladi 公司",
    "paranid": "Paranid 神域", "holyorder": "教皇圣秩", "holyorderfanatic": "圣秩信徒",
    "split": "扎亚斯氏族", "freesplit": "自由氏族", "fallensplit": "陨落氏族",
    "terran": "Terran 保护国", "pioneers": "赛格瑞斯先驱者", "xenon": "Xenon",
    "khaak": "Kha'ak", "pirate": "海盗", "player": "玩家", "alliance": "言语联盟",
    "hatikvah": "哈提克瓦自由同盟", "buccaneers": "公爵的掠夺者", "court": "库尔布斯宫廷",
    "trinity": "三位一体领域", "ministry": "财政部", "scaleplate": "鳞板契约", "yaki": "亚基",
    "loanshark": "活力辛迪加", "scavenger": "激流拾荒者", "boron": "Boron 女王国",
    "kaori": "奎塔航者", "ownerless": "无主", "visitor": "访客", "civilian": "平民",
    "smuggler": "走私者", "criminal": "罪犯", "outlaw": "法外之徒",
}

# 游戏文本里没有直接对应、或中英混排需要人工收敛的译名
OVERRIDES = {
    "Heretic's End": "异端的终结",
    "Second Contact II Flashpoint": "第二次接触 II 闪点",
    "Hewa's Twin IV The Cove": "赫瓦双子 IV 海湾",
    "Wretched Skies IV Family Valka": "悲惨的天空 IV 维尔卡家族",
    "Wretched Skies V Family Phi": "悲惨的天空 V 菲氏家族",
    "Thuruk's Demise II First Impact": "苏鲁克的消亡 II 首次冲撞",
    "Tharka's Ravine IV Tharka's Fall": "塔卡的溪谷 IV 塔卡的堕落",
    "Heart of Acrimony I The Boneyard": "刻骨之恨 I 埋骨之地",
    "Avarice V Dead End": "贪婪 V 死胡同",
    "Windfall I Union Summit": "横财 I 联盟峰会",
    "Windfall III The Hoard": "横财 III 囤积居奇",
    "Windfall IV Aurora's Dream": "横财 IV 欧若拉幻梦",
}


def parse_pages(path):
    txt = open(path, encoding="utf-8").read()
    pages = {}
    for pm in re.finditer(r'<page[^>]*id="(\d+)"[^>]*>(.*?)</page>', txt, re.S):
        d = {}
        for tm in re.finditer(r'<t id="(\d+)">(.*?)</t>', pm.group(2), re.S):
            d[tm.group(1)] = html.unescape(tm.group(2))
        pages[pm.group(1)] = d
    return pages


def resolve(pages, pid, tid, depth=0):
    if depth > 8:
        return None
    t = pages.get(pid, {}).get(tid)
    if t is None:
        return None

    def rep(m):
        r = resolve(pages, m.group(1), m.group(2), depth + 1)
        return r if r else (m.group(3) or "")

    return REF.sub(rep, t)


def clean_en(t):
    return " ".join(DIRECTIVE.sub("", t).split()) if t else None


def clean_zh(t):
    if not t:
        return None
    t = DIRECTIVE.sub("", t)
    parts = [p.strip() for p in re.split(r"[｜|]", t) if p.strip()]
    cjk = [p for p in parts if CJK.search(p)]
    out = " ".join(cjk) if cjk else (parts[-1] if parts else t)
    toks = [w for w in out.split() if not re.fullmatch(r"[A-Za-z][A-Za-z'\.\-]*", w) or ROMAN.match(w)]
    return " ".join(" ".join(toks).split())


def build_name_map(en_pages, zh_pages):
    m = {}
    for pid in ("20003", "20004"):
        for tid in en_pages.get(pid, {}):
            e = clean_en(resolve(en_pages, pid, tid))
            z = clean_zh(resolve(zh_pages, pid, tid))
            if e and z and len(e) < 60:
                m.setdefault(e, z)
    return m


def px(o):
    p = (o or {}).get("position") or {}
    return [round(p.get("x", 0), 3), round(p.get("z", 0), 3)]


def station_record(s):
    st = s.get("station") or {}
    tags = (st.get("select") or {}).get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    return {
        "id": s.get("id"),
        "owner": s.get("owner") or "",
        "type": s.get("type") or "",
        "tags": tags,
        "pos": [round((s.get("position") or {}).get("x", 0), 2),
                round((s.get("position") or {}).get("z", 0), 2)],
        "offset": [round((s.get("offset") or {}).get("position", {}).get("x", 0), 2),
                   round((s.get("offset") or {}).get("position", {}).get("z", 0), 2)],
        "location": s.get("location") or {},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="_work/qsna-analysis")
    ap.add_argument("--text", default="_work/x4text")
    ap.add_argument("--out", default="src/data/galaxy.json")
    args = ap.parse_args()

    en = parse_pages(os.path.join(args.text, "0001-l044.xml"))
    zh = parse_pages(os.path.join(args.text, "0001-l086.xml"))
    names = build_name_map(en, zh)

    def zh_name(en_name):
        nm = " ".join((en_name or "").split())
        return OVERRIDES.get(nm) or names.get(nm) or nm

    fj = json.load(open(os.path.join(args.work, "factions.json"), encoding="utf-8"))
    factions = {}
    for fid, f in fj["factionDetails"].items():
        factions[fid] = {
            "id": fid,
            "name": f.get("name"),
            "zh": FACTION_ZH.get(fid, f.get("name")),
            "short": f.get("shortname"),
            "color": ((f.get("color") or {}).get("rgba")) or "rgba(102, 102, 102, 0.6)",
            "dlc": (f.get("qsnaAttributes") or {}).get("dlc"),
        }

    m = json.load(open(os.path.join(args.work, "map.json"), encoding="utf-8"))
    clusters = []
    for c in m["data"]:
        q = c.get("qsnaAttributes") or {}
        sectors = []
        for s in c["sectors"]:
            sq = s.get("qsnaAttributes") or {}
            zones = []
            for z in s.get("zones") or []:
                zones.append({
                    "ref": z.get("ref"),
                    "macro": (z.get("macro") or {}).get("ref"),
                    "pos": px(z.get("offset")),
                    "items": [
                        {"ref": it.get("ref"), "name": it.get("name"), "pos": px(it.get("offset"))}
                        for it in (z.get("items") or [])
                    ],
                    "stations": [station_record(x) for x in (z.get("stations") or [])],
                })
            sectors.append({
                "name": s.get("name"),
                "macro": (s.get("macro") or {}).get("ref"),
                "zh": zh_name(sq.get("name")),
                "owner": sq.get("owner"),
                "dlc": sq.get("dlc") or "base",
                "pos": px(s.get("offset")),
                "sunlight": sq.get("sunlight"),
                "khaakHive": bool(sq.get("khaakHive")),
                "khaakActivity": sq.get("khaakActivity") or [],
                "regions": [r.get("regionRef") for r in (s.get("regions") or []) if r.get("regionRef")],
                "stations": [station_record(x) for x in (s.get("stations") or [])],
                "zones": zones,
            })
        clusters.append({
            "name": c.get("name"),
            "macro": (c.get("macro") or {}).get("ref"),
            "zh": zh_name(q.get("name")),
            "owner": q.get("owner"),
            "dlc": q.get("dlc") or "base",
            "pos": px(c.get("offset")),
            "sectors": sectors,
            "highways": [
                {
                    "dlc": ((h.get("qsnaAttributes") or {}).get("dlc")) or "base",
                    "connections": [
                        {"ref": cn.get("ref"), "macro": (cn.get("macro") or {}).get("ref")}
                        for cn in ((h.get("macro") or {}).get("connections") or [])
                    ],
                }
                for h in (c.get("sechighways") or [])
            ],
        })

    regions = {
        rid: {
            "dlc": r.get("dlc"),
            "volume": r.get("regionVolume") or 0,
            "replenish": r.get("regionReplenishRatePerHour") or {},
        }
        for rid, r in m["regions"].items()
    }

    galaxy = {"version": "8.0", "clusters": clusters, "regions": regions, "factions": factions}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(galaxy, f, ensure_ascii=False, separators=(",", ":"))

    total = sum(len(c["sectors"]) for c in clusters)
    print(f"clusters={len(clusters)} sectors={total} regions={len(regions)} factions={len(factions)}")
    print(f"written {args.out} ({os.path.getsize(args.out)} bytes)")


if __name__ == "__main__":
    main()
