# -*- coding: utf-8 -*-
"""Měřidlo MĚŘICKÝCH METOD.

Deset metod, do měření se berou dvě — a do verze 97 je **nikdo nikdy nezměřil**,
protože robot je neuměl použít.

    python metody.py [cesta-k-index.html]

## Jak se to měří

Stejným způsobem jako `vlna.py prinos`: postaví se **pevná obrana**, pustí se
vlna, jaká na daném území a v dané etapě **opravdu chodí**, a počítá se, kolik
vlivů projde k nulovému bodu. Jednou bez metody, jednou s ní. Táž obrana, tatáž
vlna — liší se jen ta metoda.

## ⚠ Proč NE „odehrát území robotem"

První verze tohohle skriptu nechala robota odehrát tři území s metodou a bez ní
a porovnala zbylou přesnost. Nefungovalo to a stojí za to vědět proč: přesnost
je skoro pořád 100 % a **jednou za čas se běh rozsype na nulu**. Průměr pak
neměří metodu, ale to, kolikrát z dvanácti běhů padla nula. Naměřeno takhle
vyšel Polygonový pořad při jednom opakování **+29 bodů** a při čtyřech
**−15 bodů** — a metoda přitom nemůže hru zhoršit. Měřítko musí být spojité
(kolik projde), ne prahové (dohrál / nedohrál).
"""
import sys, os, statistics
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
from vlna import SETUP, OBRANA          # tatáž pevná obrana jako u `prinos`

# (index území, etapa). Etapy se vybírají tak, aby obrana ještě STÍHALA -
# ve vlně, která projde tak jako tak, vyjde každá metoda držící tempo na nulu
# (viz README u `prinos`). Přepíše se proměnnou prostředí KDE, např. KDE=5:16,7:20
KDE = [(3, 10), (5, 12), (7, 14), (9, 16)]
if os.environ.get("KDE"):
    KDE = [tuple(int(x) for x in d.split(":")) for d in os.environ["KDE"].split(",")]
OPAK = int(os.environ.get("OPAK", "3"))
PRAH = int(os.environ.get("PRAH", "8"))  # kolik živých cílů spustí metodu

# Měřidlo metod: pevná obrana + skutečná vlna, metoda se pálí při PRAH živých
# cílech, dokud má náboje. Vrací, kolik vlivů prošlo k nulovému bodu.
SETUP2 = r"""
() => {
 // Skladba vlny se losuje. Kdyz si ji kazde mereni vylosuje znovu, je rozptyl
 // mezi vlnami VETSI nez cely rozdil mezi metodami - namereno +-5 kusu na
 // rozdily kolem 1-2. Proto se vlna vylosuje JEDNOU a tataz se pak pusti na
 // vsechny metody i na zaklad (parove srovnani).
 window.__vlna=function(mapa,etapa){
   __zaklad(mapa);
   S.wave=etapa;
   let comp=waveComp(etapa);
   if(typeof dveTrasy==='function')comp=dveTrasy(comp);
   return {comp:comp,scale:waveScale()};
 };
 window.__metoda=function(mapa,etapa,obrana,l,metoda,prah,vlna){
   __zaklad(mapa);
   if(!__postav(obrana,l))return {chyba:'obrana se nevesla'};
   recalcBuffs();
   SAVE.abilDeck = metoda ? [metoda] : [];
   S.ammo={}; S.abilUses=0;
   S.wave=etapa;
   let comp, scale;
   if(vlna){ comp=vlna.comp; scale=vlna.scale; }
   else {
     comp=waveComp(etapa);
     if(typeof dveTrasy==='function')comp=dveTrasy(comp);
     scale=waveScale();
   }
   const fronta=[]; let off=0;
   comp.forEach(([k,n,gap])=>{ for(let i=0;i<n;i++)fronta.push({k,t:off+i*(gap||1)}); off+=.6; });
   fronta.sort((a,b)=>a.t-b.t);
   let udeleno=0;
   const puvHurt=window.hurt;
   window.hurt=function(e,amount,pierce,crit,src){
     const pred=e.hp; puvHurt(e,amount,pierce,crit,src);
     udeleno+=Math.max(0,pred-e.hp);
   };
   S.leaked=0; S.waveDm=1; S.waveLoss=0;
   let t=0,vyp=0,od=0;
   while(t<220&&(vyp<fronta.length||S.enemies.length)){
     while(vyp<fronta.length&&t>=fronta[vyp].t){ spawnAt(fronta[vyp].k,0,scale,false,0); vyp++; }
     step(1/60); t+=1/60; od+=1/60;
     if(metoda&&od>=.5){
       od=0;
       const zivych=S.enemies.reduce((n,e)=>n+(e.dead?0:1),0);
       // Nivelacni porad vraci presnost, ne poskozeni - v tomhle meridle je
       // presnost vypnuta (S.acc=1e9), takze by se nikdy nespustil. Pousti se
       // tedy podle casu, aby aspon prosel a bylo videt, ze na PRUNIK nema vliv.
       const chci = (metoda==='repair') ? (S.abilUses<1&&t>6) : (zivych>=prah);
       if(chci){ const m=myAbils(); if(m&&m.length) useAbil(0); }
     }
   }
   window.hurt=puvHurt;
   return {proslo:S.leaked,vypusteno:fronta.length,udeleno:Math.round(udeleno),
           pal:S.abilUses||0};
 };
 return 'ok';
}
"""


def url(p):
    return "file:///" + os.path.abspath(p).replace("\\", "/")


def main():
    cesta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SP, "..", "index.html")
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(url(cesta), wait_until="domcontentloaded")
        pg.wait_for_function("window.__G && window.__G.SAVE", timeout=30000)
        pg.wait_for_timeout(400)
        pg.evaluate("document.getElementById('intro').classList.remove('on');"
                    "SAVE.opts.snd=0;SAVE.opts.mus=0;SAVE.testAll=1;")
        pg.evaluate(SETUP)
        pg.evaluate(SETUP2)

        metody = pg.evaluate("() => ABIL.map(a => [a.id, a.n])")
        print("PŘÍNOS MĚŘICKÝCH METOD — pevná obrana, skutečná vlna")
        print("obrana: %s (3. řada) · %d opakování · spouští se při %d živých cílech"
              % (", ".join(OBRANA), OPAK, PRAH))
        print()

        # Vlny se vylosuji dopredu a KAZDA se pusti na vsechny metody i na
        # zaklad. Porovnavaji se pak dvojice na teze vlne, takze z vysledku
        # vypadne rozptyl mezi vlnami - a ten byl vetsi nez cely mereny rozdil.
        vlny = []
        for mapa, etapa in KDE:
            for _ in range(OPAK):
                vlny.append((mapa, etapa, pg.evaluate(
                    "a=>window.__vlna(a[0],a[1])", [mapa, etapa])))

        def zmer(m):
            pr, ud, pal = [], [], []
            for mapa, etapa, vlna in vlny:
                v = pg.evaluate("a=>window.__metoda(a[0],a[1],a[2],a[3],a[4],a[5],a[6])",
                                [mapa, etapa, OBRANA, 2, m, PRAH, vlna])
                if "chyba" in v:
                    pr.append(None); ud.append(0); pal.append(0); continue
                pr.append(v["proslo"]); ud.append(v["udeleno"]); pal.append(v["pal"])
            cisty = [x for x in pr if x is not None]
            return (statistics.mean(cisty), statistics.mean(ud), statistics.mean(pal), pr)

        z_pr, z_ud, _, z_rada = zmer(None)
        print("%-22s %9s %13s %11s %7s" % ("", "projde", "obrana odvede", "ubráno", "výstř."))
        print("%-22s %9.1f %13.0f %11s %7s" % ("BEZ METODY", z_pr, z_ud, "—", "0"))
        vys = []
        for mid, mn in metody:
            p, u, s, rada = zmer(mid)
            # PAROVY rozdil: na kazde vlne zvlast, teprve pak prumer.
            dvojice = [a - b for a, b in zip(z_rada, rada)
                       if a is not None and b is not None]
            d = statistics.mean(dvojice)
            sig = (statistics.stdev(dvojice) / (len(dvojice) ** .5)) if len(dvojice) > 1 else 0
            vys.append((d, sig, mid, mn, p, u, s))
            print("%-22s %9.1f %13.0f %+7.1f±%-3.1f %7.1f" % (mn, p, u, d, sig, s))
        print()
        vys.sort(reverse=True)
        print("POŘADÍ podle toho, kolik vlivů metoda ZASTAVÍ navíc:")
        print("(hvezdicka = rozdil je aspon dvojnasobek sve chyby, tedy neni to sum)")
        for d, sig, mid, mn, p, u, s in vys:
            print("   %+6.1f ± %.1f kusu %s %-22s (%s)"
                  % (d, sig, "*" if abs(d) >= 2 * sig and sig > 0 else " ", mn, mid))
        print("\nchyby JS:", errs[:4])
        b.close()


main()
