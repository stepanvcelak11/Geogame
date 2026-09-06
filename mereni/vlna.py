# -*- coding: utf-8 -*-
"""Měřidlo GeoGame: PROJDE VLNA.

Dva režimy, obojí staví na tom, že cíle jdou po trase NORMÁLNÍ rychlostí —
na rozdíl od zmrazených cílů tedy umí ocenit dosah i zpomalení.

  pristroje  kolik poškození přístroj skutečně stihne udělit, než vlna projde
             (cíle jsou nesmrtelné, sčítá se udělené poškození přes obalený hurt)
  prinos     co přidává SCHOPNOST vlivu uvnitř skutečné míchané vlny — tatáž
             vlna, tytéž kusy, jen jednou s vypnutou schopností jednoho druhu

Použití:
    python vlna.py prinos     [cesta-k-index.html]
    python vlna.py pristroje  [cesta-k-index.html]

Býval tu i režim `vlivy`, který pouštěl proti pevné obraně vlnu z jediného
druhu. Je ZRUŠENÝ — čtyři různá provedení dala čtyři různé odpovědi a každé
měřilo něco jiného než sílu druhu; podrobně v README. Na tuhle otázku
odpovídá `prinos`.
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
 // --- REZIM PRINOS: co PRIDAVA SCHOPNOST druhu v michane vlne ----------
 // Pusti se vlna, jaka na danem uzemi a v dane etape opravdu chodi, dvakrat:
 // jednou tak, jak je, a jednou s VYPNUTOU schopnosti jednoho druhu. Tytez
 // kusy, tataz odolnost, tataz rychlost - lisi se jen ta schopnost.
 //
 // Prvni pokus tenhle rezim delal nahradou druhu za Chybu odectu o teze
 // odolnosti. Nefungovalo to: 12 Sedani bodu se nahradi 50 Chybami odectu,
 // takze se meril hlavne POCET TEL, ne schopnost - a vsechny druhy vysly pod
 // 1,0, protoze mnoho drobnych a rychlych propusti vic nez par tezkych.
 const SCHOPNOSTI={heal:['heal'],cover:['shield'],jam:['jam'],drift:['regen'],
                   jump:['jump'],blun:['split']};
 window.__prinos=function(mapa,etapa,obrana,l,vypnout){
   __zaklad(mapa);
   if(!__postav(obrana,l))return {chyba:'obrana se nevesla'};
   recalcBuffs();
   const zalohy=[];
   if(vypnout&&SCHOPNOSTI[vypnout])
     SCHOPNOSTI[vypnout].forEach(vl=>{ zalohy.push([vypnout,vl,E[vypnout][vl]]); E[vypnout][vl]=0; });
   S.wave=etapa;
   let comp=waveComp(etapa);
   if(typeof dveTrasy==='function')comp=dveTrasy(comp);
   const scale=waveScale();
   const fronta=[]; let off=0;
   comp.forEach(([k,n,gap])=>{ for(let i=0;i<n;i++)fronta.push({k,t:off+i*(gap||1)}); off+=.6; });
   fronta.sort((a,b)=>a.t-b.t);
   let udeleno=0;
   const puvodniHurt2=window.hurt;
   window.hurt=function(e,amount,pierce,crit,src){
     const pred=e.hp; puvodniHurt2(e,amount,pierce,crit,src);
     udeleno+=Math.max(0,pred-e.hp);
   };
   S.leaked=0; S.waveDm=1; S.waveLoss=0;
   let t=0,vyp=0;
   while(t<220&&(vyp<fronta.length||S.enemies.length)){
     while(vyp<fronta.length&&t>=fronta[vyp].t){ spawnAt(fronta[vyp].k,0,scale,false,0); vyp++; }
     step(1/60); t+=1/60;
   }
   window.hurt=puvodniHurt2;
   zalohy.forEach(([k,vl,hod])=>{ E[k][vl]=hod; });
   return {proslo:S.leaked,vypusteno:fronta.length,udeleno:Math.round(udeleno),sekund:Math.round(t)};
 };
 // Nejvyssi pocet kusu jednoho druhu, jaky hra kdy posle - vytazeno z HRY
 // (prochazi se waveComp pres vsechna uzemi a vsechny etapy), ne opsano do
 // skriptu. Kdyz se skladba vln zmeni, meridlo se posune s ni.
 window.__maxPocty=function(){
   const out={};
   for(let m=0;m<MAPS.length;m++){
     newRun(m,false,null,false);
     const posl=lastWaveOf();
     for(let w=1;w<=posl;w++){
       S.wave=w;
       let comp=waveComp(w);
       if(typeof dveTrasy==='function')comp=dveTrasy(comp);
       comp.forEach(([k,n])=>{ out[k]=Math.max(out[k]||0,n); });
     }
   }
   return out;
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

        if rezim == "prinos":
            KDE = [(9, 22), (11, 24), (7, 20)]     # uzemi (index), etapa
            SCH = ['jam', 'heal', 'cover', 'drift', 'jump', 'blun']
            print("CO PRIDAVA SCHOPNOST DRUHU V MICHANE VLNE")
            print("obrana: %s (3. rada)" % ", ".join(OBRANA))
            print("tataz vlna, tytez kusy - jen s vypnutou schopnosti jednoho druhu")
            print()
            for mapa, etapa in KDE:
                z = [pg.evaluate("a=>window.__prinos(a[0],a[1],a[2],a[3],a[4])",
                                 [mapa, etapa, OBRANA, 2, None]) for _ in range(3)]
                if any("chyba" in x for x in z):
                    print("uzemi %d: %s" % (mapa + 1, z[0].get("chyba"))); continue
                zp = statistics.mean(x["proslo"] for x in z)
                zu = statistics.mean(x["udeleno"] for x in z)
                print("uzemi %d, etapa %d — vsechno zapnute: proslo %.1f z %d, obrana odvedla %.0f"
                      % (mapa + 1, etapa, zp, z[0]["vypusteno"], zu))
                print("   %-12s %14s %14s %12s" %
                      ("vypnuto", "proslo", "obrana odvede", "PRINOS"))
                for k in SCH:
                    v = [pg.evaluate("a=>window.__prinos(a[0],a[1],a[2],a[3],a[4])",
                                     [mapa, etapa, OBRANA, 2, k]) for _ in range(3)]
                    if any("chyba" in x for x in v): continue
                    bp = statistics.mean(x["proslo"] for x in v)
                    bu = statistics.mean(x["udeleno"] for x in v)
                    prinos = (zp / bp) if bp else float("inf")
                    print("   %-12s %14.1f %14.0f %11.2fx" % (k, bp, bu, prinos))
                print()
            print("PRINOS = kolikrat vic projde, kdyz je schopnost ZAPNUTA.")
            print("1,00x znamena, ze schopnost s vysledkem vlny nehne.")
        elif rezim == "pristroje":
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
        print("\nchyby JS:", errs[:4])
        b.close()


if __name__ == "__main__":
    rezim = sys.argv[1] if len(sys.argv) > 1 else "prinos"
    cesta = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "index.html")
    spust(cesta, rezim)
