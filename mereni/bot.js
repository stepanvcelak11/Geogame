window.__botInit=function(){
 window.__freeCell=function(k){
   let best=null,bs=-1;
   for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
     if(ONPATH.has(c+','+r))continue;
     if(!isOpen(c,r))continue;
     if(towerAt(c,r))continue;
     if(!canBuild(k,c,r))continue;
     let sc=0;
     PATHS.forEach(pp=>pp.forEach(q=>{const d=Math.abs(q[0]-c)+Math.abs(q[1]-r); if(d<=2)sc+=3-d;}));
     if(sc>bs){bs=sc;best=[c,r];}
   }
   return best;
 };
 window.__botBuild=function(){
   let did=false;
   for(let i=0;i<S.shop.length;i++){
     const k=S.shop[i]; if(!k)continue;
     if(S.towers.length>=capMax())break;
     const cost=priceOf(k); if(S.cr<cost)continue;
     const cell=__freeCell(k); if(!cell)continue;
     S.cr-=cost;
     S.towers.push({k,l:M('startlvl')?1:0,c:cell[0],r:cell[1],cal:0,cd:0,buffD:0,buffR:0,buffT:0,spawn:.45,built:performance.now(),paid:cost});
     rebuildOcc();S.built++;S.shop[i]=null;recalcBuffs();did=true;
   }
   return did;
 };
 window.__botMerge=function(){
   let did=false;
   for(let a=0;a<S.towers.length;a++)for(let b=a+1;b<S.towers.length;b++){
     const x=S.towers[a],y=S.towers[b];
     if(!x||!y)continue;
     if(x.k!==y.k||x.l!==y.l)continue;
     if(x.l>=3&&((x.plus||0)||(y.plus||0)))continue;
     if(x.l>=3)x.plus=1;else x.l++;
     x.cal=Math.min(4,Math.max(x.cal,y.cal));x.cd=0;
     S.towers=S.towers.filter(t=>t!==y);
     S.merges++;S.mrg=(S.mrg||0)+1;
     // Robot slucuje mimo boardTap, takze si pravidlo cety musi zopakovat sam.
     // Bez toho mu ceta rostla bez stropu a kapacita v mereni vysla 33 misto 17
     // - merilo by se neco, co ve hre vubec neni.
     var __strop=(typeof CREW_MRG_MAX==='number')?CREW_MRG_MAX:1e9;
     if(S.mrg>=3&&(S.crewM||0)<__strop){S.mrg=0;S.crewM=(S.crewM||0)+1;S.crew=(S.crew||0)+1;}
     rebuildOcc();recalcBuffs();did=true;
     return true;
   }
   return did;
 };
 window.__botHrdina=function(){
  // Hrdinu robot postavi hned na zacatku - je zdarma a hraje se s nim cele
  // mereni, takze bez nej by mereni obtiznosti bylo mimo.
  if(!S||!S.hrd||S.hrdT||typeof hrdVejde!=='function')return false;
  let best=null,bs=-1;
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    if(!hrdVejde(S.hrd,c,r))continue;
    let sc=0;
    PATHS.forEach(pp=>pp.forEach(q=>{
      const d=Math.abs(q[0]-(c+.5))+Math.abs(q[1]-(r+.5));
      if(d<=3)sc+=4-d;}));
    if(sc>bs){bs=sc;best=[c,r];}
  }
  if(!best)return false;
  S.towers.push({k:S.hrd,l:0,c:best[0],r:best[1],sz:T[S.hrd].sz||2,cal:0,cd:0,
    buffD:0,buffR:0,buffT:0,spawn:0,built:performance.now(),paid:0,hero:1});
  S.hrdT=S.towers[S.towers.length-1];
  rebuildOcc();recalcBuffs();
  return true;
 };
 window.__botHrdVylep=function(){
  // Vylepsovat hrdinu az potom, co je na deske aspon neco dalsiho - jinak
  // by robot utratil cely rozpocet na jednu vec.
  if(!S||!S.hrdT||typeof hrdUpCost!=='function')return false;
  let did=false;
  for(let i=0;i<3;i++){
    const c=hrdUpCost(S.hrdT);
    if(c===null||S.cr<c+120)break;
    S.cr-=c;S.hrdT.l++;S.hrdT.drones=null;S.hrdT.cd=0;did=true;
  }
  if(did)recalcBuffs();
  return did;
 };
 // ---- MERICKE METODY ----------------------------------------------------
 // Robot je dosud neumel, a proto o desiti metodach ve hre neexistovalo ani
 // jedno mereni. Bez nich meri obranu, ktera ma na etapu dva nevyuzite naboje.
 // Politika je zamerne prosta a pro vsechny metody STEJNA, aby se jednotlive
 // metody daly mezi sebou porovnat: pal, jakmile je na trase dost cilu.
 // Vyjimka je Nivelacni porad - ten se pali podle ztracene presnosti, protoze
 // pri plne presnosti hra naboj vraci a mereni by stalo na miste.
 window.__botZivych=function(){
   return S.enemies.reduce((n,e)=>n+(e.dead?0:1),0);
 };
 window.__botMetody=function(prah){
   if(!S||S.phase!=='combat')return false;
   const met=(typeof myAbils==='function')?myAbils():[];
   if(!met.length)return false;
   const zivych=__botZivych();
   let pal=false;
   met.forEach((a,i)=>{
     if(!a)return;
     S.ammo=S.ammo||{};
     if(S.ammo[a.id]===undefined)S.ammo[a.id]=abilMax(a.id);
     if(S.ammo[a.id]<=0)return;
     if(a.id==='repair'){ if(S.acc>94)return; }
     else if(zivych<(prah||8))return;
     useAbil(i);pal=true;
   });
   return pal;
 };
 // Odehraje jednu etapu vcetne metod. Metody se zkousi dvakrat za sekundu -
 // castejc to nema smysl, hra sama je pousti klepnutim.
 window.__botEtapa=function(prah){
   let t=0,u=0;
   while(S.phase==='combat'&&!S.over&&t<900){
     step(1/60);t+=1/60;u+=1/60;
     if(u>=.5){u=0;if(prah)__botMetody(prah);}
   }
   return t;
 };
 window.__bot=function(mapIdx,hard,merge){
   newRun(mapIdx,false,null,!!hard);
   const log=[];let g=0;
   while(!S.over&&S.wave<lastWaveOf()&&g++<40){
     rollShop(true);
     for(let pass=0;pass<25;pass++){
       let d=false;
       if(merge)d=__botMerge()||d;
       d=__botBuild()||d;
       if(!d)break;
     }
     const before=S.acc;
     startWave();
     let t=0;
     while(S.phase==='combat'&&!S.over&&t<900){step(1/60);t+=1/60;}
     log.push({w:S.wave,acc:Math.round(S.acc),ztrata:Math.round(before-S.acc),
               vezi:S.towers.length,cap:capMax(),cr:Math.round(S.cr),sec:Math.round(t),
               maxL:S.towers.reduce((m,t2)=>Math.max(m,t2.l),0)});
   }
   return {log,over:S.over,acc:Math.round(S.acc),wave:S.wave,last:lastWaveOf(),
           vyhra:S.acc>0&&S.wave>=lastWaveOf()};
 };
 return 'ok';
};
window.__botSmart=function(){
 // sit
 let did=false;
 NET.forEach(u=>{
   const n=S.net[u.id]||0; if(n>=u.max)return;
   const c=u.cost(n);
   if(S.cr>=c+40){S.cr-=c;S.net[u.id]=n+1;did=true;}
 });
 // kalibrace
 for(let i=0;i<40;i++){
   const t=S.towers.filter(x=>x.cal<4).sort((a,b)=>b.l-a.l)[0];
   if(!t)break;
   const c=calCost(t);
   if(S.cr<c+40)break;
   S.cr-=c;t.cal++;did=true;
 }
 // Mistrovska rada: kdyz uz neni co slucovat ani kalibrovat, hvezda je jedine,
 // kam pozdni rozpocet tece. Robot ji kupuje na nejsilnejsi pristroj a nechava
 // si rezervu na stavbu, at nemeri "utratil vsechno na jednu vez".
 if(typeof mistrCost==='function'){
   for(let i=0;i<12;i++){
     const kand=S.towers.filter(t=>mistrCost(t)!==null)
                        .sort((a,b)=>(a.plus||0)-(b.plus||0)||b.l-a.l)[0];
     if(!kand)break;
     const c=mistrCost(kand);
     if(S.cr<c+150)break;
     if(typeof mistrKoup==='function'){ if(!mistrKoup(kand))break; }
     else { S.cr-=c; kand.plus=(kand.plus||0)+1; }
     did=true;
   }
 }
 recalcBuffs();
 return did;
};
window.__bot2=function(mapIdx,hard){
 newRun(mapIdx,false,null,!!hard);
 if(window.__botHrdina)__botHrdina();
 const log=[];let g=0;
 while(!S.over&&S.wave<lastWaveOf()&&g++<40){
   rollShop(true);
   for(let pass=0;pass<25;pass++){let d=__botMerge();d=__botBuild()||d;if(!d)break;}
   __botSmart();
   if(window.__botHrdVylep)__botHrdVylep();
   const before=S.acc;
   startWave();
   // Metody jsou ZAMERNE vypnute, dokud si je nekdo nezapne (`window.__botPrah`).
   // Duvod: vsechna drivejsi mereni obtiznosti vznikla bez metod a robot s nimi
   // je o kus silnejsi - kdyby se zapnuly potichu, vypadala by hra nahle lehci
   // a nekdo by podle toho pritvrdil vlny.
   const t=__botEtapa(window.__botPrah||0);
   log.push({w:S.wave,acc:Math.round(S.acc),ztrata:Math.round(before-S.acc),vezi:S.towers.length,
             cap:capMax(),cr:Math.round(S.cr),sec:Math.round(t),
             maxL:S.towers.reduce((m,x)=>Math.max(m,x.l),0),
             cal:S.towers.reduce((m,x)=>m+x.cal,0)});
 }
 return {log,over:S.over,acc:Math.round(S.acc),wave:S.wave,last:lastWaveOf(),vyhra:S.acc>0&&S.wave>=lastWaveOf()};
};
