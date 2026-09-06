# -*- coding: utf-8 -*-
"""Rozhoduje otazku: je soustredena vlna zvysenim obtiznosti, nebo ukolem pro
vyber sestavy?

Pusti robota na TUTEZ soustredenou vlnu dvakrat - jednou se sestavou, kterou
ma hrac na zacatku, a jednou se sestavou vybranou PROTI te soustredeni.
Kdyz se ztrata vyberem sestavy vrati, je to ukol pro hrace. Kdyz ne, je to
prosta obtiznost.
"""
import sys, os, statistics
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SP = os.path.dirname(os.path.abspath(__file__))
BOT = open(os.path.join(SP, "bot-head.js"), encoding="utf-8").read()
url = "file:///" + os.path.abspath(
    sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\stepa\Desktop\geogame\index.html").replace("\\", "/")

SETUP = r"""
(druh)=>{
 // Soustredena vlna: ze skutecne skladby se vezme 40 % odolnosti a preleje
 // se do jednoho druhu. Celkova odolnost vlny zustava, meni se jen to, ceho
 // je vlna plna.
 if(!window.__puvComp) window.__puvComp=window.waveComp;
 if(!druh){ window.waveComp=window.__puvComp; return 'puvodni'; }
 window.waveComp=function(w){
   const comp=window.__puvComp(w).map(x=>x.slice());
   let odebranoHp=0;
   comp.forEach(z=>{
     if(z[0]===druh||z[0]==='boss')return;
     const uber=Math.floor(z[1]*0.40);
     if(uber<=0)return;
     odebranoHp+=uber*E[z[0]].hp;
     z[1]-=uber;
   });
   const pridat=Math.max(1,Math.round(odebranoHp/E[druh].hp));
   const uz=comp.find(z=>z[0]===druh);
   if(uz)uz[1]+=pridat; else comp.push([druh,pridat,1.2]);
   return comp.filter(z=>z[1]>0);
 };
 return 'soustredeno na '+druh;
}
"""
BEH = r"""
(a)=>{
 const [m,deck]=a;
 newRun(m,false,null,false);
 if(deck&&deck.length){ S.deck=deck.slice(); rollShop(true); }
 if(window.__botHrdina)__botHrdina();
 let g=0;
 while(!S.over&&S.wave<lastWaveOf()&&g++<40){
   if(deck&&deck.length)S.deck=deck.slice();
   rollShop(true);
   for(let pass=0;pass<25;pass++){let d=__botMerge();d=__botBuild()||d;if(!d)break;}
   __botSmart(); if(window.__botHrdVylep)__botHrdVylep();
   startWave();
   let t=0; while(S.phase==='combat'&&!S.over&&t<900){step(1/60);t+=1/60;}
 }
 return {wave:S.wave,last:lastWaveOf(),acc:Math.round(S.acc),vyhra:S.acc>0&&S.wave>=lastWaveOf()};
}
"""

ZACATECNI = ['tape', 'theo', 'nivel', 'edm']
POKUSY = [
    # soustredeni,  sestava proti nemu,                     cim ma pomoct
    ('subs',  ['theo', 'sonar', 'multi', 'insar'], 'proti panciri (Sedani bodu ma pancir 3)'),
    ('noise', ['tape', 'nivel', 'lidar', 'edm'],   'proti roji (Sum je rychly a drobny)'),
    ('jam',   ['quadrant', 'insar', 'multi', 'basecal'], 'z dalky (Rusicka umlcuje okoli)'),
]
MAPY = [6, 7, 8, 9]

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
    pg.add_script_tag(content=BOT)
    pg.evaluate("window.__botInit()")
    pg.evaluate(SETUP.replace("(druh)=>", "(druh)=>"), None)   # jen definuje

    def kolo(deck):
        vyh = 0; acc = []
        for m in MAPY:
            for _ in range(2):
                r = pg.evaluate(BEH, [m, deck])
                if r["vyhra"]: vyh += 1
                acc.append(r["acc"])
        return vyh, statistics.mean(acc)

    print("Uzemi 7-10, 2 behy na uzemi (8 behu na radek). Robot ze skladu.\n")
    pg.evaluate(SETUP, None)
    zv, za = kolo(ZACATECNI)
    print("BEZ SOUSTREDENI, zacatecni sestava:            %d/8 vyher, presnost %.0f %%\n" % (zv, za))
    for druh, proti, proc in POKUSY:
        pg.evaluate(SETUP, druh)
        av, aa = kolo(ZACATECNI)
        bv, ba = kolo(proti)
        print("soustredeno na '%s' (%s)" % (druh, proc))
        print("   zacatecni sestava %-28s %d/8 vyher, presnost %.0f %%" % (",".join(ZACATECNI), av, aa))
        print("   vybrana sestava   %-28s %d/8 vyher, presnost %.0f %%" % (",".join(proti), bv, ba))
        print("   -> vyber sestavy vratil %+d vyher, %+.0f bodu presnosti\n" % (bv - av, ba - aa))
    pg.evaluate(SETUP, None)
    print("chyby JS:", errs[:4])
    b.close()
