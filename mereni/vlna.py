# -*- coding: utf-8 -*-
"""Měřidlo GeoGame: PROJDE VLNA.

Dva režimy, obojí staví na tom, že cíle jdou po trase NORMÁLNÍ rychlostí —
na rozdíl od zmrazených cílů tedy umí ocenit dosah i zpomalení.

  pristroje  kolik poškození přístroj skutečně stihne udělit, než vlna projde
             (cíle jsou nesmrtelné, sčítá se udělené poškození přes obalený hurt)
  vlivy      jak silný je který vliv proti PEVNÉ obraně, při stejném tlaku
             (stejná odolnost za sekundu) — výsledkem je naměřený násobek

Použití:
    python vlna_nastroj.py vlivy      [cesta-k-index.html]
    python vlna_nastroj.py pristroje  [cesta-k-index.html]
"""
import sys, os, statistics
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SETUP = r"""
() => {
 // --- společné: postavit sadu stanovisek na nejlepší políčka u trasy
 window.__postav=function(sest,l){
   for(const k of sest){
     const z=(T[k].sz||1); let nej=null,nejsc=-1;
     for(let c=0;c+z<=COLS;c++)for(let r=0;r+z<=ROWS;r++){
       let lze=true;
       for(let a=0;a<z&&lze;a++)for(let b=0;b<z&&lze;b++){
         const cc=c+a,rr=r+b;
         if(ONPATH.has(cc+','+rr)||occupied(cc,rr)||!canBuild(k,cc,rr))lze=false; }
       if(!lze)continue;
       let sc=0;
       PATHS.forEach(pp=>pp.forEach(q=>{
         const d=Math.abs(q[0]-(c+(z-1)/2))+Math.abs(q[1]-(r+(z-1)/2));
         if(d<=3)sc+=4-d;}));
       if(sc>nejsc){nejsc=sc;nej=[c,r];}
     }
     if(!nej)return false;
     S.towers.push({k,l,c:nej[0],r:nej[1],sz:z,cal:0,cd:0,buffD:0,buffR:0,
                    buffT:0,spawn:0,built:0,paid:0});
     rebuildOcc();
   }
   return true;
 };
 window.__zaklad=function(mapa){
   newRun(mapa||0,false,null,false);
   S.open=null; S.towers=[]; S.hrdT=null; S.hrd=null; S.wave=6;
   S.enemies=[]; S.queue=[]; S.fx=[]; S.zones=[]; S.vir=[];
   S.phase='combat'; S.acc=1e9;      // průnik nesmí měření ukončit
   rebuildOcc();
 };

 // --- REŽIM PRISTROJE -------------------------------------------------
 // Cíle jsou nesmrtelné (odolnost ×400), takže se nic nepřestřelí a měří se
 // čistý výkon. Poškození se sbírá obalením hurt(), ne dopočtem z odolnosti —
 // jinak by se ztratilo to, co padne na cíl, který mezitím projde.
 const puvodniHurt=hurt;
 window.__skoda=0;
 window.hurt=function(e,amount,pierce,crit,src){
   const pred=e.hp;
   puvodniHurt(e,amount,pierce,crit,src);
   window.__skoda+=Math.max(0,pred-e.hp);
 };
 window.__pristroj=function(k,pocet,l,sekund){
   __zaklad(0);
   if(!__postav(new Array(pocet).fill(k),l))return {chyba:'nevešlo se'};
   recalcBuffs();
   const SADA=[['err',12,.9],['noise',8,.28],['subs',4,1.7],['multi',2,1.0],['boss',1,4.5]];
   let off=0;
   SADA.forEach(([ek,n,gap])=>{ for(let i=0;i<n;i++)S.queue.push({k:ek,t:off+i*gap,pi:0}); off+=.6; });
   S.queue.sort((a,b)=>a.t-b.t);
   S.waveTotal=S.queue.length; S.waveDm=1; S.waveLoss=0; S.spawnT=0;
   window.__skoda=0;
   const puvodniScale=window.waveScale;
   window.waveScale=function(){return 400;};
   let t=0;
   while(t<sekund&&(S.queue.length||S.enemies.length)){ step(1/60); t+=1/60; }
   window.waveScale=puvodniScale;
   return {skoda:Math.round(window.__skoda),cena:priceOf(k)*pocet*Math.pow(2,l)};
 };

 // --- REŽIM VLIVY -----------------------------------------------------
 // Proti PEVNÉ obraně jde vlna složená z jediného druhu vlivu. Každý druh
 // dostane STEJNÝ POČET kusů i STEJNOU ODOLNOST NA KUS (násobek se dopočítá
 // z jeho základní odolnosti), takže se druhy liší UŽ JEN CHOVÁNÍM — rychlostí,
 // pancířem, regenerací, umlčováním stanovisek, léčením okolí, krytím,
 // přeskakováním trasy. Měří se, jaká část vlny projde k nulovému bodu.
 // Vypouští se ručně, ne přes S.queue, aby šla odolnost nastavit po kusech.
 window.__vliv=function(druh,obrana,l,odolnostKusu,pocet,gap){
   __zaklad(0);
   if(!__postav(obrana,l))return {chyba:'obrana se nevešla'};
   recalcBuffs();
   const scale=odolnostKusu/E[druh].hp;
   S.waveTotal=pocet; S.waveDm=1; S.waveLoss=0; S.leaked=0;
   let t=0, vypusteno=0, dalsi=0;
   while(t<gap*pocet+150&&(vypusteno<pocet||S.enemies.length)){
     if(vypusteno<pocet&&t>=dalsi){ spawnAt(druh,0,scale,false,0); vypusteno++; dalsi+=gap; }
     step(1/60); t+=1/60;
   }
   return {pocet:pocet, proslo:S.leaked, podil:S.leaked/pocet, sekund:Math.round(t)};
 };
 return 'ok';
}
"""

VLIVY = ['err','refr','noise','subs','multi','blun','jam','drift','heal','cover','jump']
OBRANA = ['tape','tape','theo','theo','edm','edm','nivel','nivel']   # startovní sestava
PRISTROJE = ['tape','theo','edm','nivel','lidar','compass','sonar','penta','quadrant',
             'backpack','machine','gpr','gravi','multi','insar']


def spust(cesta, rezim):
    url = "file:///" + os.path.abspath(cesta).replace("\\", "/")
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(url, wait_until="domcontentloaded")
        pg.wait_for_function("window.__G && window.__G.SAVE", timeout=30000)
        pg.wait_for_timeout(400)
        pg.evaluate("document.getElementById('intro').classList.remove('on');"
                    "SAVE.opts.snd=0;SAVE.opts.mus=0;SAVE.testAll=1;")
        pg.evaluate(SETUP)

        if rezim == "pristroje":
            print("PROJDE VLNA — poškození na 1 rozpočtu (4 stanoviska, 27 nesmrtelných cílů)")
            print("%-10s %6s | %8s %8s | %8s %8s" % ("přístroj", "cena", "3. řada", "4. řada", "/kredit3", "/kredit4"))
            for k in PRISTROJE:
                r3 = [pg.evaluate("a=>window.__pristroj(a[0],a[1],a[2],a[3])", [k, 4, 2, 180]) for _ in range(2)]
                r4 = [pg.evaluate("a=>window.__pristroj(a[0],a[1],a[2],a[3])", [k, 4, 3, 180]) for _ in range(2)]
                if any("chyba" in x for x in r3 + r4):
                    print("%-10s -" % k); continue
                s3 = statistics.mean(x["skoda"] for x in r3); c3 = r3[0]["cena"]
                s4 = statistics.mean(x["skoda"] for x in r4); c4 = r4[0]["cena"]
                print("%-10s %6d | %8.0f %8.0f | %8.1f %8.1f"
                      % (k, pg.evaluate("k=>priceOf(k)", k), s3, s4, s3 / c3, s4 / c4))
        else:
            # Tlak se ladí ODOLNOSTÍ NA KUS při pevném počtu. Dřív jsem ladil
            # násobek při pevném rozpočtu odolnosti celé vlny — to jen měnilo,
            # na kolik kusů se táž odolnost rozdělí, a sílu vlny nechalo být.
            POCET, GAP = 24, 1.1
            odolnost = 400
            for _ in range(12):
                r = pg.evaluate("a=>window.__vliv(a[0],a[1],a[2],a[3],a[4],a[5])",
                                ['err', OBRANA, 2, odolnost, POCET, GAP])
                if r.get("chyba"): print("CHYBA:", r["chyba"]); return
                if r["podil"] < .20: odolnost = int(odolnost * 1.5)
                elif r["podil"] > .45: odolnost = int(odolnost / 1.25)
                else: break
            print("PROJDE VLNA — naměřená síla vlivů")
            print("obrana: %s (3. řada)" % ", ".join(OBRANA))
            print("každý druh: %d kusů po %d odolnosti, jeden každých %.1f s —"
                  " liší se tedy UŽ JEN CHOVÁNÍM" % (POCET, odolnost, GAP))
            print("odolnost doladena tak, aby Chyba odectu propoustela kolem tretiny")
            print()
            print("%-22s %5s %7s %8s %9s" % ("vliv", "kusů", "prošlo", "podíl", "NÁSOBEK"))
            zaklad = None
            radky = []
            for k in VLIVY:
                v = [pg.evaluate("a=>window.__vliv(a[0],a[1],a[2],a[3],a[4],a[5])",
                                 [k, OBRANA, 2, odolnost, POCET, GAP]) for _ in range(3)]
                if any("chyba" in x for x in v):
                    print("%-22s -" % k); continue
                podil = statistics.mean(x["podil"] for x in v)
                pocet = v[0]["pocet"]
                proslo = statistics.mean(x["proslo"] for x in v)
                if k == 'err': zaklad = podil
                radky.append((k, pocet, proslo, podil))
            for k, pocet, proslo, podil in radky:
                nas = podil / zaklad if zaklad else 0
                print("%-22s %5d %7.1f %7.0f %% %8.2f×" % (k, pocet, proslo, podil * 100, nas))
        print("\nchyby JS:", errs[:4])
        b.close()


if __name__ == "__main__":
    rezim = sys.argv[1] if len(sys.argv) > 1 else "vlivy"
    cesta = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "index.html")
    spust(cesta, rezim)
