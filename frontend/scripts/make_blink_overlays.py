"""从概念图原始帧生成「闭眼」覆盖层（不重绘：眼睛像素换成它周围屏幕的原始像素，中间留一行原始眼睛像素当作闭眼线）。
输出 public/agent/mascot/blink/<frame>.png（与原帧同尺寸，其余全透明）+ blink.json（哪些帧可用）。"""
import json, sys
from collections import deque
from pathlib import Path
from PIL import Image

D = Path(__file__).resolve().parents[1] / "public/agent/mascot"
OUT = D / "blink"; OUT.mkdir(exist_ok=True)

def cyan(p):
    r, g, b, a = p
    return a > 200 and g > 170 and b > 160 and r < 150

def dark(p):
    r, g, b, a = p
    return a > 200 and r < 60 and g < 90 and b < 100

def blobs(im):
    w, h = im.size; px = im.load(); seen = set(); out = []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not cyan(px[x, y]): continue
            q = deque([(x, y)]); seen.add((x, y)); pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and cyan(px[nx, ny]):
                        seen.add((nx, ny)); q.append((nx, ny))
            if len(pts) > 30: out.append(pts)
    return out

def surrounded_by_screen(im, pts):
    px = im.load(); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs) - 3, max(xs) + 3, min(ys) - 3, max(ys) + 3
    ring = [(x, y0) for x in range(x0, x1)] + [(x, y1) for x in range(x0, x1)] + [(x0, y) for y in range(y0, y1)] + [(x1, y) for y in range(y0, y1)]
    ok = sum(1 for x, y in ring if 0 <= x < im.size[0] and 0 <= y < im.size[1] and dark(px[x, y]))
    return ok / max(1, len(ring)) > 0.75

avail = {}
for f in sorted(D.glob("*.png")):
    im = Image.open(f).convert("RGBA"); px = im.load()
    cands = []
    for b in blobs(im):
        xs = [p[0] for p in b]; ys = [p[1] for p in b]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if bh >= 1.3 * bw and bh >= 20 and surrounded_by_screen(im, b):   # 竖条形眼睛
            cands.append((b, min(xs), min(ys), bw, bh))
    cands.sort(key=lambda c: -len(c[0]))
    eyes = cands[:2]
    if len(eyes) != 2 or abs(eyes[0][2] - eyes[1][2]) > 25 or abs(len(eyes[0][0]) - len(eyes[1][0])) > 0.5 * len(eyes[0][0]):
        print(f.stem, "跳过（找不到一对眼睛）"); continue
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); op = ov.load()
    for b, x0, y0, bw, bh in eyes:
        # 用眼睛左侧紧邻的原始屏幕像素列逐行填充（不发明颜色）
        mid = y0 + bh // 2
        for y in range(y0 - 2, y0 + bh + 2):
            src = px[max(0, x0 - 4), y]
            for x in range(x0 - 2, x0 + bw + 2):
                op[x, y] = src if dark(src) else px[x0 - 4, mid]
        for y in (mid - 1, mid, mid + 1):        # 闭眼线：原始眼睛中间三行像素
            for x in range(x0, x0 + bw):
                if cyan(px[x, mid]): op[x, y] = px[x, mid]
    ov.save(OUT / f.name); avail[f.stem] = True
    print(f.stem, "OK", [(e[1], e[2], e[3], e[4]) for e in eyes])
(OUT / "blink.json").write_text(json.dumps(avail))
