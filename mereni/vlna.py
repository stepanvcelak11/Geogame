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
 // Návrh session c5, lepší než obě předchozí: VYPNOUT UMÍRÁNÍ. Cíle jsou
 // nesmrtelné a stojí na místě, takže z měření vypadne práh „došel / nedošel"
 // i vliv rychlosti. Měří se JEDINÁ věc: kolik poškození obrana za daný čas
 // NETTO odvede, když proti ní stojí tenhle druh. Do toho se samo započítá
 //   - umlčování stanovisek (rušička, boss)   → obrana míň střílí
 //   - krytí okolí (zákryt)                   → míň poškození dopadne
 //   - léčení a regenerace (léčitel, drift)   → část se vrátí zpět
 //   - pancíř                                 → míň z rány projde
 // Rychlost se měří ZVLÁŠŤ (čistý čas na trase), ne smíchaná dohromady.
 window.__vliv=function(druh,obrana,l,pocet,sekund){
   __zaklad(0);
   if(!__postav(obrana,l))return {chyba:'obrana se nevešla'};
   recalcBuffs();
   const puvodniSp=E[druh].sp;
   E[druh].sp=0;                       // stoji na miste
   const L=pathOf(0).length-1;
   for(let i=0;i<pocet;i++) spawnAt(druh,1+(i/pocet)*(L-2),400,false,0);
   S.enemies.forEach(e=>{e.hp=e.mhp;e.el=null;});
   const pred=S.enemies.reduce((a,e)=>a+e.mhp,0);
   let t=0; while(t<sekund){ step(1/60); t+=1/60; }
   const po=S.enemies.reduce((a,e)=>a+Math.max(0,e.hp),0);
   E[druh].sp=puvodniSp;
   return {netto:Math.round(pred-po), zbylo:S.enemies.length};
 };
 // Rychlost zvlast: cisty cas, za ktery druh projde trasu bez odporu.
 window.__rychlost=function(druh){
   __zaklad(0);
   spawnAt(druh,0,400,false,0);
   let t=0;
   while(t<400&&S.enemies.length){ step(1/60); t+=1/60; }
   return {sekund:+t.toFixed(1)};
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
            SEKUND = 30
            print("PROJDE VLNA - namerena sila vlivu (verze s vypnutym umiranim)")
            print("obrana: %s (3. rada)" % ", ".join(OBRANA))
            print("Nesmrtelne cile jednoho druhu stoji na trase, meri se %d s." % SEKUND)
            print("NASOBEK = o kolik odvede obrana min prace nez proti Chybe odectu.")
            print("Meri se pri TREH i pri DVACETI kusech, protoze u umlcovani a leceni")
            print("neni ucinek na poctu linearni - tri rusicky nejsou petina dvaceti.")
            print("Rychlost je zvlast, neni v tom zamichana.")
            print()
            print("%-22s %10s %8s | %10s %8s | %9s %8s" %
                  ("vliv", "NETTO 3", "nasobek", "NETTO 20", "nasobek", "trasa (s)", "rychlost"))
            radky = []
            for k in VLIVY:
                mer = {}
                for n in (3, 20):
                    v = [pg.evaluate("a=>window.__vliv(a[0],a[1],a[2],a[3],a[4])",
                                     [k, OBRANA, 2, n, SEKUND]) for _ in range(3)]
                    if any("chyba" in x for x in v): mer = None; break
                    mer[n] = statistics.mean(x["netto"] for x in v)
                if mer is None:
                    print("%-22s -" % k); continue
                cas = pg.evaluate("k=>window.__rychlost(k)", k)["sekund"]
                radky.append((k, mer[3], mer[20], cas))
            z3 = next((x[1] for x in radky if x[0] == 'err'), 1) or 1
            z20 = next((x[2] for x in radky if x[0] == 'err'), 1) or 1
            zc = next((x[3] for x in radky if x[0] == 'err'), 1) or 1
            for k, n3, n20, cas in radky:
                print("%-22s %10.0f %7.2fx | %10.0f %7.2fx | %9.1f %7.2fx"
                      % (k, n3, z3 / n3 if n3 else 0, n20, z20 / n20 if n20 else 0,
                         cas, zc / cas if cas else 0))
            print()
            print("Nasobek > 1 = obrana proti tomu druhu odvede min prace nez proti")
            print("Chybe odectu; to je ta cast hrozby, kterou NENESE odolnost.")
            print("Nasobek 0 znamena, ze obrana neodvedla nic (uplne umlcena).")
        print("\nchyby JS:", errs[:4])
        b.close()


if __name__ == "__main__":
    rezim = sys.argv[1] if len(sys.argv) > 1 else "vlivy"
    cesta = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "index.html")
    spust(cesta, rezim)
