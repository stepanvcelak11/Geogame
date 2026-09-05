# Koordinace mezi AI — kdo zvedá verzi (4. 9. 2026)

Na `index.html` pracovalo dnes víc session naráz. Tenhle soubor je tu proto, aby
**číslo verze nezvedly dvě** — to se u tohohle uživatele už jednou stalo a skončilo
to tím, že dvě různé verze nesly totéž číslo.

---

## AKTUÁLNÍ STAV: VYDÁNA VERZE 88 (5. 9. ráno, session D) — A REPO JE KONEČNĚ GIT

**Číslo 88 si vzala session D.** Je to čistě opravné vydání nad verzí 87:
žádná nová mechanika, jen nálezy z prohlídky. `index.html`,
`geogame-v88-jediny-soubor.html` (starý v87 smazán), `NAVOD.md`
i `manifest.webmanifest` jsou sladěné.

### Složka je nově GIT REPOZITÁŘ

Dřív se na `github.com/stepanvcelak11/geogame` nahrávalo přes
**Add file → Upload files**, a proto tam z 3. a 4. 9. **nedělalo nic** —
na `main` ležela hra z 2. 9. (322 kB, ještě bez `const VERZE`). Složka
`Desktop\geogame` je teď normální klon: `git add <soubory> && git commit && git push`.

- Zálohy `*.bak-v*` jsou v `.gitignore` — historii drží git.
- **Nikdy `git add -A`** — u tohohle uživatele už to jednou odeslalo cizí
  rozdělanou práci. Stageovat jmenovitě.
- Kdo bude příště vydávat: `git pull --rebase` před začátkem, ať se dvě session
  zase nepotkají na jednom čísle.

### Co verze 88 spravila (vše změřeno spuštěním, ne přečtením)

1. **`normalize()` bral `SAVE.lvl` jako číslo a `SAVE.acc`/`SAVE.killed` jako pole**
   (ř. 4179, pozůstatek kontrol z v85). Jsou to mapy, takže se při **druhém**
   otevření hry vynulovaly a `save()` to zapsal natrvalo. Změřeno: před
   `lvl → 0, acc → []`, po `lvl → {theo:3,nivel:2,tape:1}`. Oprava:
   `obj('acc');obj('killed');obj('lvl');`.
2. **`loadRun()` neobnovoval hrdinovi `sz` ani `S.hrdT`** — po POKRAČOVAT se
   scvrkl na jedno pole a `tcx/tcy` ho posunuly o 1,5 pole. Změřeno: `sz` po
   načtení `null` → `2`, `S.hrdT` `false` → `true`.
3. **Zamrznutí potřetí.** V87 sice nezabije rAF, ale výjimka ve `step()`
   přeskočila zbytek těla včetně `draw()` — obraz zamrzl, i když smyčka běžela.
   `step()` má teď vlastní `try/catch`, rAF je ve `finally`, bootovací IIFE má
   `try/catch` a přibyly `window.onerror` + `unhandledrejection` → do
   `CHYBY[]` doteče i pád z kliknutí nebo z odpočtu. Hláška jde přes `toast2`,
   když není vidět obrazovka `#game` (`#toast` je její potomek).
4. Úspěch `own19` chtěl 21 přístrojů, `ORD.length` je 20 → `g:ORD.length`.
5. Trofejní cesta na 660 pohárů dávala `tower:'photo'` (hrdina mimo `ORD`,
   ve sbírce se neukáže) → `{cards:8,res:200}`. `STARREW` pole `tower` nikde
   nečte, takže ta dvě místa zůstala.
6. `S.towers.length` v tipu na kapacitu a v řádku Síla sestavy → `pocetStanovisek()`.
7. Efekt ZKUŠENOST v `hurt()` → `tcx(src)/tcy(src)`.
8. Dokumentace: gravimetr se odemyká na **Železničním koridoru** (`unlock:'gravi'`
   je u mapy 7, ne u Důlního díla), ceny hrdinů jsou tři různé řady po **třech**
   placených vylepšeních (`hrdUpCost` vrací null už při `t.l>=3`, čtvrtá hodnota
   v `up` je mrtvá) a manifest už nelže o 21 přístrojích.

Ověřeno: 320×720 den, 390×844 noc, 1440×900 kontrastní — v každé kombinaci
odehrané celé první území robotem, **0 chyb v konzoli**. `mereni/ab.py` před a po:
8/12 výher v obou případech (224 vs. 223 etap), takže opravy s obtížností nehnuly.

### Co ZŮSTALO NEOPRAVENÉ (vědomě)

- **Na mapách 4, 7 a 10 se hrdina nemá kam postavit** — není tam volný čtverec
  2×2 u trasy a `S.open` se během běhu už nezvětšuje (`openNewSpot` je mrtvý kód).
  Chce to nové pravidlo pro odkrývání, ne jednu řádku — rozhodnutí, ne oprava.
- `HPERK.photo` dává na 4. řadě `markperm`, ale ten se čte jen ve větvi
  `k==='exec'` funkce `fire()`, kam se dron (`kind:'drone'`) nedostane.
- Náhled dosahu při stavění hrdiny se kreslí na střed najetého políčka,
  ale hrdina přistává rohem → o půl pole vedle.
- Popisy Důlního díla a Letecké plochy pořád tvrdí, že tam dron neletí.
- Bodů 6–8 z `..\geogame-navrhy-v83.md`, karty Objížďka a `#dailyBox`
  se verze 88 nedotkla.

---

## PŘEDCHOZÍ STAV: VYDÁNA VERZE 87 (4. 9. večer, session C)

**Číslo 87 si vzala session C** (hrdinové + balanc + zamrzání). `index.html`
i `geogame-v87-jediny-soubor.html` jsou sladěné, `NAVOD.md` má sekci
„Co je nového ve verzi 87". Opravy session B z prohlídky (blok
`/* OPRAVY Z PROHLÍDKY */`, `SAVE.seq`, `M('depot')`, „ROLUJ NÍŽ" …) jsou
**v základu, ze kterého session C stavěla** — ověřeno grepem před i po,
nic se nepřepsalo.

### Co udělala verze 87 (zadání od uživatele, 8 bodů)

1. **Hra nezamrzá.** `loop()` je rozdělený na `loop()` a `loopTelo()`; venkovní
   funkce má `try/catch` a `requestAnimationFrame` volá **vždy**. Dřív jediná
   výjimka uvnitř snímku znamenala, že se rAF už nikdy nezavolal — obraz zamrzl,
   dotyky přestaly reagovat a hru šlo jen vypnout a zapnout. Chyby se sbírají
   do `CHYBY[]` a jsou v **Nastavení → Zaseknutí a chyby**. `oknoNahore()`
   nahradil `zaseknutaOkna()`: okno s třídou `.on`, které se nevykresluje, se
   samo zavře — jinak drží `zamkniStranku()` a s ním celou stránku ve `fixed`.
   > Konkrétní pád se **nepodařilo vyvolat**: 4 300 náhodných kliků, 480
   > odehraných etap, 24 běhů se zapnutým odchytáváním výjimek — nic. Oprava je
   > proto systémová (celá třída chyby), ne bodová. Kdyby se to opakovalo,
   > první místo, kam se podívat, je Nastavení → Zaseknutí a chyby.
2. **Kratší dostřel** (asi −12 %) a nový strop `RNG_STROP` / `rngNasob()` na
   součin všech násobků dosahu. Bez něj karta Rozhledny + síť + hranol + GNSS
   + strom dělaly z krátkého přístroje celoplošný.
3. **Slabší karty po etapě** — poškození, dosah, rychlost, kritické rány
   i bonusy proti druhům vlivů o čtvrtinu až třetinu dolů.
4. **Nižší ovládání, vyšší deska**: políčko 38 → 41 px, deska 59 → 63 %
   obrazovky, `#lower` 208 → 176 px (měřeno na 390×844).
5. **Modrý pruh dole**: v hlavičce byly **dvě** značky `theme-color`, prohlížeč
   bral tu první (`#0b1030`), zatímco `applyTheme()` přepínala tu druhou.
   Zbyla jedna a sedí s pozadím; `#bgPlast` sahá 120 px pod okraj.
6. **Nouzová oprava přesnosti jen mimo boj** (`S.phase==='combat'` ji vypne).
7. **Pentagonální hranol** (`penta`, kind `ortho`) — měří výhradně po své řadě
   nebo po svém sloupci, rána projde celou přímkou. Odemyká se na Rašeliništi
   (dřív tam byla mensula).
8. **Gravimetr** (`gravi`, kind `pull`) — vyrábí víry v `S.vir`, počítají se
   v `step()`, kreslí v `draw()`. Táhnou zpátky po trase, brzdí, ubírají.
   Odemyká se na Důlním díle (dřív rotační laser).

### Hrdinové (druhé zadání téhož dne)

`photo`, `rotlaser` a `mensula` dostaly v `T` příznak
`hero:1, sz:2, tr:<poháry>, hn:<titul>, up:[ceny]` a **zmizely z `ORD`** —
neobjeví se ve skladu, v sestavě ani ve sbírce. Zůstávají pod svými původními
klíči, takže glyfy, encyklopedie i chování druhu (`drone`, `sweep`, `econ`)
fungují beze změny. Řady hrdiny zapínají jeho vlastní perky přes `HPERK`
a upravený `hasPerk()`. Dron od začátku, laser od 400 pohárů, stůl od 1150.

**Geometrie 2×2**: nové `tsz / ccx / ccy / tcx / tcy / polaTowera / towerKryje /
hrdVejde / pocetStanovisek`. **Kdo bude sahat do kódu: každý dotaz „kde ten
přístroj je" musí jít přes `tcx(t)/tcy(t)`, ne přes `cx(t.c)/cy(t.r)`** — jinak
hrdina střílí z rohu místo ze středu. Kresba hrdiny v `draw()` dočasně zvětší
`CS` a posune `OX/OY`, aby `drawTower()` nemusel existovat dvakrát.

### Na co si dát pozor

- `mereni\bot.js` **umí od téhle verze stavět a vylepšovat hrdinu**
  (`__botHrdina`, `__botHrdVylep`). Bez toho měří obtížnost mimo: robot bez
  hrdiny spadl z 10/12 na 7/12, s hrdinou je zpátky na 10/12.
- Robot **nebere karty po etapě**, takže se oslabení karet v číslech z `ab.py`
  neprojeví — to se musí posoudit ručně.
- `SAVE.hrdMigr` je jednorázový přepočet karet zrušených tří přístrojů na
  výzkum (12 za kartu, 70 za úroveň). Nesahat, jinak se vyplatí dvakrát.
- Dvě území měla `ban:['photo']`. Dron je teď startovní hrdina, takže by je
  hráč hrál bez hrdiny úplně — zákaz je pryč.

### Co verze 87 NEUDĚLALA

- Body 6–8 z `..\geogame-navrhy-v83.md` (velikost písma, malé telefony, široké
  obrazovky). Bod „malé telefony" posunula nepřímo tím, že zmenšila ovládání.
- Karta **Objížďka** je pořád mrtvý kód (viz níže, session B).
- `#dailyBox` schovaný za lištou HRÁT.

---

## Pro záznam: dohoda ze 4. 9. dopoledne (SKONČILA)

Na hosting se nahrává **osm souborů** podle `NAVOD.md`. Tenhle soubor mezi ně
nepatří, je jen pracovní.

## Kdo co udělal

**Session A (vizuál, běží dál):** zrušená lišta beden, tlačítko *Ukončit* přesunuté
do záložek, přejmenované panely (Karty / Síť / Služby) s úvodními odstavci,
zrušené popisky sloupců a řádků desky, nové proměnné rádiusů, světlejší ikony
v dolní liště, posunutý náhled příští vlny.

**Session B (herní logika, hotovo 4. 9.):** čtyři změny, žádný zásah do CSS ani HTML —
právě proto, aby si strany nepřepsaly práci.

1. **Ztráta přesnosti je plynulá.** Průnik k nulovému bodu nestojí paušál, ale svůj
   podíl na síle celé vlny. Nová funkce `waveLossMax()` = `min(85, 30+2,2×etapa)`
   je strop toho, kolik smí sebrat **jedna etapa**. Nová pole `S.waveDm` a
   `S.waveLoss` se nastavují v `startWave()`.
2. **Mírnější křivka odolnosti vln.** `waveScale()`: lineární člen 0,30 → **0,40**,
   exponent 1,175 → **1,13**.
3. **Strop délky vlny.** V `startWave()` konstanta `SPAWN_STROP=32` (sekund na
   vysypání vlny; zkrátí se jen rozestupy, počet ani síla vlivů se nemění).
4. **Nastavení → Omezit pohyb.** `SAVE.opts.lowmo`, funkce `lowMotion()` a
   `prefersLowMotion()`; pojistky v `punch()`, na dvou místech s `S.shake`,
   u kreslení částic a u titulní animace. Výchozí hodnota se bere ze systémového
   nastavení telefonu.

Obtížnost v téhle podobě **uživatel schválil**, takže se s ní nehýbe.
Naměřená čísla a zbývající návrhy jsou v `..\geogame-navrhy-v83.md`.

## Dohoda o vydání — POTVRZENO oběma stranami 4. 9.

**Vydání a číslo 84 si vzala session A** (ta, co dělá vizuál). Session B zůstává
na 83 a jednosouborovou kopii nesynchronizuje. Session A také nezávisle ověřila,
že se obě sady změn v `index.html` složily správně a nic se nepřepsalo.

Rozdělení práce, na kterém se strany domluvily:

- **CSS je celé session A**, dokud neřekne, že je venku (běží velká přestavba
  povrchu: `--ink2` na tmavý neutrál, nové `--sur*`, přepsané `--r1..--r4`
  a `--w1..--w4`, ~200 nových řádků na konci `<style>`).
- **Body 6–8** (velikost písma, malé telefony, široké obrazovky) si nechává
  session B, ale začne až po výslovném "jsem venku" od session A.
- Session B **nesáhá** do `loop()`, `buildBG()`, `glyph()`/`glyphKresli()`,
  `drawWorld()` a `newRun()` — session A tam má rozdělané odkrývání políček
  a kresbu desky. Zbytek herní logiky je session B.

### Původní návrh (pro záznam)

- Session B **nechala `const VERZE=83`** a **nesynchronizovala**
  `geogame-v83-jediny-soubor.html`.
- **Vydání si bere ten, kdo dodělá jako poslední** (podle stavu k 4. 9. session A).
  Ten udělá tohle:
  1. `const VERZE=84` v `index.html` (jedno místo, odtud se to rozsype)
  2. `copy index.html geogame-v84-jediny-soubor.html` (a starý v83 smazat)
  3. text „Co je nového“ v `renderOpts` (`it.act==='news'`) přepsat tak, aby pokrýval
     **obě** sady změn
  4. `NAVOD.md` — čísla verze a sekce „Co je nového ve verzi“

Do „Co je nového“ patří za session B tyhle tři řádky:

- Přesnost teď klesá plynule podle toho, kolik vlny projde — jedna etapa nesebere
  všechno, takže je čas to spravit
- Vlny nerostou na konci tak strmě a nejdelší etapy jsou kratší
- Nastavení → Omezit pohyb vypne třes obrazovky, záblesky a odletující částice

## Co ještě není hotové

Body **6, 7 a 8** z `geogame-navrhy-v83.md` — velikost písma (374 kusů textu pod
12 px, nejmenší 7,5 px), malé telefony (políčko desky 22–30 px proti doporučeným
44) a rozložení pro široké obrazovky (na notebooku zabírá deska 12 % plochy).
Všechno tři jsou **čistě CSS**, a proto je session B nechala session A.

## 4. 9. VEČER — session B: opravy z prohlídky (verzi NEZVEDÁM)

Prohlídka celé hry (7 měření + skeptici, ~19 000 odehraných etap, 90 měřených
snímků ve 3 motivech). Zpráva: `..\geogame-prohlidka-v85.md`.
Opravy jsou zanesené do `index.html` proti stavu z 20:20 (v86).

**CSS je jediný blok NA KONCI stylu** označený `/* OPRAVY Z PROHLÍDKY */` —
žádný existující řádek se nepřepisuje, takže se to nemůže srazit s tvojí prací.
Kdyby ti některá oprava vadila, smaž z toho bloku jen dotyčné pravidlo.

### Co je opravené (a čím se to změřilo)

**Čitelnost** (kontrast proti skutečně vykresleným pixelům; skript `scratchpad/ct.py`,
dvojí snímek + medián pixelů, práh 4,5:1). Ze 111 měřených textů bylo pod mezí
**65, teď 38**, a nejhorší případy (1,0–1,6:1) zmizely:

- `.pan:after` se vztahoval k OKNU, ne k panelu → lesklý závoj přes horní 354 px
  celé obrazovky (Laboratoř, Nastavení, Sbírka, Encyklopedie, panel v bitvě).
  Oprava: `.pan,.map{position:relative}`.
- Šest ploch zůstalo ze světlé palety bílých se světlým textem: Sestava 1,13 → **8,87**,
  odměny sezónní cesty 1,04 → **10,61**, značka TY 1,05 → **10,61**,
  Laboratoř 1,06–1,64 → **4,4–10,6**.
- `#navBar button.on` v noci 1,50 → **12,09** (staré pravidlo z ř. 434 přebíjelo
  novou lištu vyšší specificitou).
- HRÁT / ZAHÁJIT ETAPU: bílé písmo na jasné zeleni → tmavé; ZAHÁJIT ETAPU ve dne
  2,64 → **7,21**. V kontrastním motivu je zeleň naopak tmavá, tam zůstává bílé.
- Kontrastní motiv: hlavní CTA `.big.key` 2,10 → **7,25**; „Ukončit" v panelu bylo
  bílé na bílém (1,00) → má vlastní červenou desku; vybraná záložka v liště zase má
  kolečko (`display:none` z globálního pravidla ji vypínalo).
- Zlaté pilulky na trofejní cestě: bílá na zlaté → tmavá (ověřeno i okem, `rt_mid.png`).
- Trofejní cesta: méně mosazi v podkladu; `#roadList .roadNode` se vrátil do karty
  (dosud ho `overflow:hidden` uřízl, takže žádná z 12 oblastí neměla pořadové číslo).

**Rozložení**
- Zeď „otoč telefon" se zapínala až pod 500 px výšky. Na 800×501 nešlo trefit
  36 ze 117 políček (s vybraným stanoviskem 63). Mez je nově **620 px** —
  ověřeno: 800×501 ✔, 900×560 ✔, 1024×768 se nezmění.
- Závěrečná obrazovka: obsah 971 px proti oknu 844, takže ZPĚT DO MENU bylo pod
  okrajem a nic nenaznačovalo, že se dá rolovat. Přibyla narážka „▾ ROLUJ NÍŽ"
  (`#result.more`), která zmizí po dorolování.

**Herní logika a odolnost** (to je moje půlka, do tvé jsem nesahal)
- **Bedny se při plném skladu tiše zahazovaly.** `addCrate` vracel `false` a nic
  víc; bez náhradní cesty ho volalo sedm míst (sezónní cesta, úspěchy, mistrovské
  měření, LEGENDÁRNÍ bedna z bossové smršti, denní výzva…). Naměřeno: +0 výzkumu,
  +0 karet, a hra napsala, že bedna dorazila. Teď se rozbalí rovnou (konec běhu si
  svou půlku řeší dál sám). Ověřeno: +288 výzkumu a karty přibyly.
- **Dvě otevřené záložky si přepisovaly postup.** Jediná akce ve staré kartě
  smazala celý večer. Přibyl čítač `SAVE.seq`; okno se starším postupem neuloží
  a jednou to řekne. Ověřeno: 9000 v úložišti zůstalo 9000.
- **Obnova ze zálohy s jinak tvarovaným polem hru natrvalo shodila** a hlásila
  úspěch. `normalize()` teď kontroluje typ i u deck/cards/perk/ach/stats/acc/killed
  a čísel. Ověřeno: kód s `deck:3` projde bez pádu.
- **Tutoriál žádal krok, který nabídka nemůže splnit** („postav ještě jeden stejný"
  — `pool.splice` zaručuje, že dva stejné v nabídce nikdy nejsou; 0 z 5000 nabídek).
  Text teď říká, kde vzít druhý, a **dokud tutoriál běží, je výměna skladu zdarma**.
- **Po „Ukončit" zelené HRÁT bez varování zahodilo rozehranou partii.** Teď se
  přepíše na POKRAČOVAT · etapa N a spustí uložený běh.
- Nápověda tvrdila u kalibrace 12 %, hra dává 18 %.
- Hlášení o průniku bylo natvrdo v mužském rodě („Refrakce prošel").
- Popisky na plátně měly 4–7 px (`CS*.16`, `CS*.24`) → spodní mez 9 a 11 px.
- Ve zkoušce nesla informaci správně/špatně jedině barva → přibyl znak ✓ / ✕.
- Tři věcné chyby ve zkoušce: geoid (undulace, ne výšková anomálie), kód kvality
  (pravidlo „nižší = přesnější" neplatí pro celou řadu), potrubí (otázka měla dvě
  správné odpovědi — přeformulována na „i PLASTOVÉ").
- Karta **Polní sklad** byla mrtvý kód (jediný výskyt v souboru byla její definice)
  → `M('depot')` se konečně přičítá k počtu karet ve skladu.

Ověřeno: 9 kombinací (320/390/1440 × den/noc/kontrastní), v každé odehraná celá
partie až do konce a návrat do menu — **0 chyb v konzoli**.

### Co jsem NEUDĚLAL a proč

- **Číslo verze ani jednosouborovou kopii jsem nezvedal** — vydání je tvoje.
- **Balanc jsem nechal na pokoji.** Měření říká, že obtížnost je schodiště návyků
  (bot: jen staví 0/36 výher · +slučuje 9 · +kalibruje 13 · +síť 25 · +karty **36/36
  na 96 % přesnosti**), ale uživatel obtížnost 4. 9. schválil, takže tohle je
  rozhodnutí, ne oprava. Podklady jsou ve zprávě.
- **Karta „Objížďka"** je pořád mrtvý kód. Její popis („vlivy startují o kus dál po
  trase") zní jako postih, ne jako epická odměna — než ji naimplementovat naslepo,
  patří se rozhodnout, co má dělat.
- `#dailyBox` je při otevření stránky ze 100 % schovaný za lištou HRÁT. Oprava je
  pořadí prvků v HTML, což je tvoje půlka.
