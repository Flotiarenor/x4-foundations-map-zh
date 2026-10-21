"""从 X4 的 .cat/.dat 归档里抽出中英文文本文件。

用法：
    python tools/extract-x4-text.py --game "E:/SteamLibrary/steamapps/common/X4 Foundations" --out _work/x4text
"""

import argparse
import hashlib
import os
import sys


def extract(game, out, wanted=("t/0001-l044.xml", "t/0001-l086.xml")):
    os.makedirs(out, exist_ok=True)
    found = set()
    for name in sorted(os.listdir(game)):
        if not name.endswith(".cat") or "_sig" in name:
            continue
        cat = os.path.join(game, name)
        dat = os.path.join(game, name[:-4] + ".dat")
        if not os.path.exists(dat):
            continue
        entries = []
        with open(cat, encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.rstrip("\r\n")
                if not line.strip():
                    continue
                parts = line.rsplit(" ", 3)
                if len(parts) != 4:
                    continue
                path, size, ts, md5 = parts
                try:
                    entries.append((path, int(size), int(ts), md5))
                except ValueError:
                    continue
        offset = 0
        with open(dat, "rb") as d:
            for path, size, _ts, md5 in entries:
                if path in wanted and path not in found:
                    d.seek(offset)
                    data = d.read(size)
                    ok = hashlib.md5(data).hexdigest() == md5
                    dest = os.path.join(out, os.path.basename(path))
                    with open(dest, "wb") as w:
                        w.write(data)
                    print(f"{path}: {size} bytes md5_ok={ok} -> {dest}")
                    found.add(path)
                offset += size
    if found != set(wanted):
        missing = set(wanted) - found
        print("missing:", missing, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", required=True, help="X4 Foundations 安装目录")
    ap.add_argument("--out", default="_work/x4text", help="输出目录")
    args = ap.parse_args()
    raise SystemExit(extract(args.game, args.out))
