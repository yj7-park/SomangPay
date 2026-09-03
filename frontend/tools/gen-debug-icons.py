#!/usr/bin/env python3
"""개발 서버 구분용 디버그 뱃지 아이콘/매니페스트 생성기.

원본 아이콘(favicon*.ico, icons/icon-*.png, icons/apple-touch-icon*.png,
icons/logo-mark*.svg)과 매니페스트(manifest*.json)에 빨간 좌하단 리본 + 'DEV' 글자를
합성/삽입해 `<name>-debug.<ext>` 로 저장한다. 확장자 앞에 '-debug' 를 끼워넣는 규칙은
frontend/src/env-badge.js 의 href 재작성과 정확히 같다.

원본 아이콘을 바꿨을 때 이 스크립트를 다시 돌려 -debug 세트를 갱신한다:
    python3 frontend/tools/gen-debug-icons.py
안드로이드 런처용 리본(app/src/debug/res/drawable-nodpi/ic_debug_ribbon.png)도 같이 만든다.
필요 패키지: Pillow.
"""
import collections
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FRONT = os.path.dirname(HERE)
REPO = os.path.dirname(FRONT)
ICONS = os.path.join(FRONT, "icons")
ANDROID_RIBBON = os.path.join(
    REPO, "android_kiosk/app/src/debug/res/drawable-nodpi/ic_debug_ribbon.png"
)

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
RED = (229, 45, 45, 255)
RED_DARK = (140, 20, 20, 255)
WHITE = (255, 255, 255, 255)


def _font(size):
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def ribbon_layer(size, inset_frac=0.0):
    """size x size 투명 레이어에 좌하단 대각선 리본(+DEV). 4x 슈퍼샘플링."""
    s = size
    scale = 4
    S = s * scale
    big = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)

    m_outer = S * (0.40 + inset_frac)      # 코너에서 바깥 리본선까지 (클수록 중앙 쪽으로)
    band = S * 0.24                        # 리본 폭
    m_inner = m_outer + band
    poly = [(0, S - m_outer), (0, S - m_inner), (m_inner, S), (m_outer, S)]
    d.polygon(poly, fill=RED)
    ew = max(2, S // 200)
    d.line([(0, S - m_outer), (m_outer, S)], fill=RED_DARK, width=ew)
    d.line([(0, S - m_inner), (m_inner, S)], fill=RED_DARK, width=ew)

    mm = (m_outer + m_inner) / 2.0
    t = 0.5                                # 리본 중심선 세그먼트의 중점
    cx, cy = mm * t, (S - mm) + mm * t
    fsize = int(band * 0.52)
    font = _font(fsize)
    tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    bbox = td.textbbox((0, 0), "DEV", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    td.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), "DEV", font=font, fill=WHITE)
    tmp = tmp.rotate(-45, center=(cx, cy), resample=Image.BICUBIC)
    big.alpha_composite(tmp)

    return big.resize((s, s), Image.LANCZOS)


def _badged(src_path, maskable=False):
    im = Image.open(src_path).convert("RGBA")
    lay = ribbon_layer(max(im.size), inset_frac=0.14 if maskable else 0.0)
    if lay.size != im.size:
        lay = lay.resize(im.size, Image.LANCZOS)
    im.alpha_composite(lay)
    return im


def _dbg(path):
    root, ext = os.path.splitext(path)
    return root + "-debug" + ext


def main():
    tasks = []
    for base in ["", "-kiosk", "-user", "-admin"]:
        tasks.append((f"apple-touch-icon{base}.png", False))
        for sz in ["192", "512"]:
            tasks.append((f"icon-{sz}{base}.png", False))
            tasks.append((f"icon-{sz}{base}-maskable.png", True))
    for name, mask in tasks:
        src = os.path.join(ICONS, name)
        if not os.path.exists(src):
            print("skip (missing):", name)
            continue
        _badged(src, mask).save(os.path.join(ICONS, _dbg(name)))
        print("png ->", os.path.relpath(os.path.join(ICONS, _dbg(name)), FRONT))

    for name in ["favicon.ico", "favicon-kiosk.ico", "favicon-user.ico", "favicon-admin.ico"]:
        src = os.path.join(FRONT, name)
        if not os.path.exists(src):
            print("skip (missing):", name)
            continue
        im = Image.open(src).convert("RGBA").resize((64, 64), Image.LANCZOS)
        im.alpha_composite(ribbon_layer(64))
        out = os.path.join(FRONT, _dbg(name))
        im.save(out, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        print("ico ->", os.path.relpath(out, FRONT))

    ribbon = (
        '  <!-- 개발 서버 구분용 디버그 리본 (env-badge.js가 개발 환경에서만 이 -debug 아이콘으로 교체) -->\n'
        '  <g>\n'
        '    <polygon points="0,64.8 0,38.88 64.8,108 43.2,108" fill="#e52d2d"/>\n'
        '    <polygon points="0,64.8 43.2,108" fill="none" stroke="#8c1414" stroke-width="1"/>\n'
        '    <polygon points="0,38.88 64.8,108" fill="none" stroke="#8c1414" stroke-width="1"/>\n'
        '    <text x="27" y="80" transform="rotate(-45 27 80)" fill="#ffffff" text-anchor="middle" '
        'dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" '
        'font-size="14" letter-spacing="0.5">DEV</text>\n'
        '  </g>\n'
        '</svg>'
    )
    for base in ["", "-kiosk", "-user", "-admin"]:
        src = os.path.join(ICONS, f"logo-mark{base}.svg")
        if not os.path.exists(src):
            print("skip (missing):", os.path.basename(src))
            continue
        s = open(src, encoding="utf-8").read()
        out = s[: s.rfind("</svg>")] + ribbon
        dst = os.path.join(ICONS, f"logo-mark{base}-debug.svg")
        open(dst, "w", encoding="utf-8").write(out)
        print("svg ->", os.path.relpath(dst, FRONT))

    for src_name, dst_name in [
        ("manifest.json", "manifest-debug.json"),
        ("manifest-user.json", "manifest-user-debug.json"),
        ("manifest-admin.json", "manifest-admin-debug.json"),
    ]:
        src = os.path.join(FRONT, src_name)
        if not os.path.exists(src):
            print("skip (missing):", src_name)
            continue
        d = json.load(open(src, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
        d["name"] = d["name"] + " (DEV)"
        d["short_name"] = d["short_name"] + " (DEV)"
        for ic in d.get("icons", []):
            ic["src"] = _dbg(ic["src"])
        with open(os.path.join(FRONT, dst_name), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("manifest ->", dst_name)

    if os.path.isdir(os.path.dirname(ANDROID_RIBBON)):
        ribbon_layer(432, inset_frac=0.16).save(ANDROID_RIBBON)
        print("android ->", os.path.relpath(ANDROID_RIBBON, REPO))

    print("done")


if __name__ == "__main__":
    main()
