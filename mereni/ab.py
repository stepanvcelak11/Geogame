# -*- coding: utf-8 -*-
import json, sys, statistics
from playwright.sync_api import sync_playwright
BOT = open("bot.js", encoding="utf-8").read()

def run(url):
    res = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(url, wait_until="domcontentloaded")
        pg.wait_for_function("window.__G && window.__G.SAVE", timeout=30000)
        pg.wait_for_timeout(600)
        pg.evaluate("document.getElementById('intro').classList.remove('on');SAVE.opts.snd=0;SAVE.opts.mus=0;")
        pg.add_script_tag(content=BOT)
        pg.evaluate("window.__botInit()")
        for m in range(12):
            res["u%d" % m] = pg.evaluate("m=>window.__bot2(m,false)", m)
        res["errors"] = errs[:8]
        b.close()
    return res

def souhrn(res, jmeno):
    etap = 0; nula = 0; cast = 0; smrt = 0
    rozpeti = []; vyhry = 0
    for k, v in res.items():
        if k == "errors":
            continue
        if v["vyhra"]:
            vyhry += 1
        lg = v["log"]
        for e in lg:
            etap += 1
            z = e["ztrata"]
            if z <= 0:
                nula += 1
            elif e["acc"] == 0:
                smrt += 1
            else:
                cast += 1
        if lg and lg[-1]["acc"] == 0:
            first = next((e["w"] for e in lg if e["ztrata"] > 0), lg[-1]["w"])
            rozpeti.append(lg[-1]["w"] - first + 1)
    print("--- %s" % jmeno)
    print("  vyher: %d/12   etap: %d" % (vyhry, etap))
    print("  etap bez ztraty: %d (%.1f %%)" % (nula, nula / etap * 100))
    print("  etap s castecnou ztratou: %d (%.1f %%)" % (cast, cast / etap * 100))
    print("  etap od prvni ztraty do konce (medián): %s  prumer %.1f" % (
        statistics.median(rozpeti) if rozpeti else "-",
        statistics.mean(rozpeti) if rozpeti else 0))
    print("  vysledky:", " ".join("%s:%s%%%s" % (k, v["acc"], "V" if v["vyhra"] else "")
                                  for k, v in res.items() if k != "errors"))
    print("  chyby:", res["errors"])
    return dict(vyhry=vyhry, nula=nula / etap * 100, cast=cast / etap * 100,
                rozp=statistics.mean(rozpeti) if rozpeti else 0)

if __name__ == "__main__":
    # Pouziti:  python ab.py <cesta-k-souboru-A> [cesta-k-souboru-B]
    # Bez argumentu meri soubor vedle sebe (..\index.html).
    import os
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    def url(p):
        return "file:///" + os.path.abspath(p).replace("\\", "/")
    args = sys.argv[1:] or [os.path.join(os.path.dirname(__file__), "..", "index.html")]
    for i, cesta in enumerate(args):
        souhrn(run(url(cesta)), os.path.basename(os.path.abspath(cesta)) + " (%d)" % (i + 1))
