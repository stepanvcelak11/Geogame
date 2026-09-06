# Koordinace mezi AI — kdo zvedá verzi (4. 9. 2026)

Na `index.html` pracovalo dnes víc session naráz. Tenhle soubor je tu proto, aby
**číslo verze nezvedly dvě** — to se u tohohle uživatele už jednou stalo a skončilo
to tím, že dvě různé verze nesly totéž číslo.

---

## AKTUÁLNÍ STAV: VERZE 100 (6. 9. večer, session „režimy a texty")

**Číslo 100 je zabrané.** Větev **`vylepseni-v100`**, vlastní git worktree
`Desktop\geogame-v100`, základ `4674c42` (špička v96).
Na main to nejde — vydání drží uživatel.

Souběžně jely **čtyři session na jednom `index.html`**. Rajóny jsme si rozdělili
přímým psaním mezi session (samotná KOORDINACE na to nestačí):

| verze | session | rajón |
|---|---|---|
| 97 | ar-geodet-6b | čísla a obsah: `T`, `E`, `ABIL`, `NET`, `CARDS`, `RYS`, `MAPS`, `GOALS`, ceny, dosahy, odolnosti, `mereni/*`, mapa světa, pás krajiny, `40-teren.css` |
| 98 | ar-geodet-ce | bitevní obrazovka: `#game`, `70-hra.css`, `loop`/`draw`/`ui`, deska, HUD, `#quick`, `#uzavr`, `saveRun`/`loadRun`, `sw.js`, tutoriál, zvuk |
| 99 | ar-geodet-51 | menu: obchod, vybavení, skiny, laborka, kariéra, sezónní cesta, nastavení, profil, encyklopedie, `10-chrome` … `80-okna` |
| 100 | tahle | **režimy navíc a výzvy jako obsah** (`CHMODS`, `CHTIERS`, `QUESTS`, `ACH`, `LOGIN`, Bossová smršť, Rychlé měření, Nekonečné, zkouška) **+ texty hlášek** |

### Kam jsem sáhl mimo svůj rajón (domluveno předem)

Dvě místa uvnitř Bossové smrště, obojí odsouhlasené s 6b, který se jich sám
nedotkl:

1. `waveComp()` — **jen větev `if(S&&S.rush5)`**: počet bossů `1+w/4` → `2+0,7w`.
2. `finaleRysy()` — `if(!S||S.rush5)return []` → bossové ve smršti dostávají
   rysy z `RYS`. Na kampaň to nesahá, ověřeno měřením (v kampani padnou rysy
   dál jen v poslední etapě).

A jeden řádek v `pgTeren`: chybějící `<div id="todoBox">` do sekce `.tUkoly`.

### Co je ve 100

Podrobně v `NAVOD.md`, sekce „Co je nového ve verzi 100". Zkráceně: mrtvý
modifikátor „Štědrá zakázka", panel „Co teď", který se nikdy nevykreslil,
přihlašovací řada zaseknutá na sedmém dni (finále znovu a znovu každý den),
Bossová smršť jako nejlehčí režim ve hře přes legendární bednu, bedny za režimy
bez denního stropu, prohra přebíjející výhru v historii výzvy, úspěch, který šel
zpět, nesplnitelný úspěch, šest chyb ve skloňování a slib „dvojice pravidel",
který 46 dnů z 365 neplatil.

### ⚠⚠ Co jsem NEZMĚNIL, ale někdo by to vědět měl

**Nová hra startuje se zapnutým testovacím režimem.** Výchozí `SAVE` má natvrdo
`testAll:1`, takže úplně nový hráč má hned **všech 23 přístrojů, 10 metod,
5 hrdinů, 30 000 výzkumu, 1 200 mezníků a 40 karet** (změřeno na čistém
uložení). Ve v96 to bylo zapnuté na výslovné přání kvůli testování, jenže v96
je od té doby na mainu — takže to takhle jede i ve vydané hře. **Rozhodnutí je
na uživateli**, proto jsem na to nesáhl.

### Nástroje, které vznikly (scratchpad session)

`hraj.py` (třída na otevření hry, focení a klikání) · `rezimy.py` (robot přes
všechny režimy navíc) · `ukoly.py` (kolik jedno měření dá do každého denního
úkolu) · `smrst3.py` (hustota Bossové smrště zvlášť za začátečníka a za
koncovku) · `kontrola.py` (měřená kontrola všech oprav) · `klikani.py`
(spuštění režimů klepáním) · `vyzvy61.py` (rozbor denní výzvy přes celý rok).

⚠ **Robot nepoužívá metody a slučuje mimo `boardTap`** — proto mu denní úkoly
„Použij metodu" a „Dostaň přístroj do 3. řady" vyšly na nulu. **Není to vada
hry**; ověřeno zvlášť lidskou cestou (9 použití metod a 2 sloučení do 3. řady
za osm etap). Kdo bude měřit úkoly robotem, ať se tím nenechá zmást.

⚠ **`window.S` z prohlížeče nevidíš** — hra ho drží v uzávěru a ven jde jen
přes `window.__G.S`. Napoprvé mi kvůli tomu vyšlo, že se žádný režim nespustil.

---

## AKTUÁLNÍ STAV: VERZE 96 (6. 9., session „připomínky") — SEZNAM PŘIPOMÍNEK HRÁČE

**Číslo 96 je zabrané, další si berte 97.** Větev **`pripominky-v96`**, vlastní
git worktree `Desktop\geogame-pripominky-v96`.
Na main to ZATÍM NEJDE — vydání si drží uživatel.

### Čeho se to týká

Prakticky celého `index.html`: obchod (mezníky, denní nabídka, vzhledy s tvarem),
vybavení (mřížkový výběr, zdroj přístrojů, hrdinové), terén (mapa nahoru,
krajina podle území, profil do rohu, ozubené kolo), laborka (6 → 11 vylepšení),
kariéra (cesty obráceně, sezónní cesta v okně) a bitva (rychlá lišta, panel
jedné výšky, Karty a ? pryč, síť a služby).

**Herní čísla, na která JSEM sáhl** — kdo dělá balanc, ať to ví:
`NET` (položka `cap` zrušena, přibyly `rate` a `cheap`), `META` (6 → 11 položek,
u původních poloviční krok a dvojnásobek úrovní se STEJNÝM stropem),
`capMax()` (přestal číst `S.net.cap`), `priceOf`, `dmgOf`, `rngOf`, `rateOf`,
`critOf`, nouzová oprava 8 → 4 %, `T` (tři přístroje a dva hrdinové navíc),
`ABIL` (tři metody navíc), `AREN` (tři odměny přehozené na metody),
`MAPS[0].unlock`. **`waveScale` ani `waveComp` NE.**

⚠ **Testovací režim je nově ZAPNUTÝ pro novou hru** (na výslovné přání hráče,
aby si mohl projít i Příslušenství). Vypíná se v Nastavení — a ten přepínač
až doteď vůbec nefungoval, zapisoval do `SAVE.opts.testAll`, zatímco
`hasType`/`hasAbil`/`accOpen` čtou `SAVE.testAll`.

Změřeno robotem, 3 kola × 12 území: **10/12 výher u v95 i u v96**, etap bez
ztráty 87,3 % → 90,5 % (s vypnutým testovacím režimem 89,3 %). Obtížnost se
tedy prakticky nehnula.

---

## Předchozí: VERZE 94 (6. 9. večer, session „vizuál") — VZHLED DESKY A OKEN Větev **`vizual-v94`**, vlastní
git worktree `C:\Users\stepa\Desktop\geogame-vizual-v93` (jméno složky je
starší než přečíslování a nic neznamená).

### Co je v 94

Vzhled, nic jiného. Podrobně v `NAVOD.md`. Dvě kola:

1. **Deska bitvy.** Menu, obchod a Laborka už měly tmavý „přístrojový" vzhled,
   ale deska u toho zůstala stát: bledá louka se světlými čtverci. Podstavce
   stanovisek jsou teď tatáž tmavá destička jako karty ve Vybavení; zem, cesta
   a přístroj mají tři odlišné světlosti; terénní pole a rám desky konečně
   berou barvu z palety (v noci svítily denními barvami); v noci jde poznat
   cesta od vody; ubralo se šedesát oranžových značek a mříž „trávy".
2. **Okna, která hráč vidí nejčastěji.** Nezískaná hvězda měla výplň skoro
   bílou — po **prohře** svítily tři hvězdy a nerozehrané území vypadalo jako
   dohrané na tři (táž vada na dvou místech: `.rstars` a `.stIco`). Prohra
   měla mosazné záhlaví i záři jako výhra. Výběr karty po etapě byly tři
   stejné ploché obdélníky.

**Na pravidla se nesáhlo.** `waveScale`, `waveComp`, `capMax`, `E`, `T`, `NET`,
`CARDS` ani odměny nebyly otevřeny — grep na herní čísla v celém diffu vrátil
nulu. Proto se tahle větev s balancem, gameplayem ani obsahem nemá kde potkat;
jediný konflikt v `index.html` byl při každém rebase řádek `const VERZE=`.

### Čím je to podložené

- 9 kombinací (320/390/1440 × den/noc/kontrastní) × menu, náhled přístroje
  v obchodě, bitva, pět záložek panelu, okno výběru karty a okno výsledku:
  **0 chyb**.
- Robot `mereni/ab.py`: 229 etap, **0 chyb**.
- Lišta rychlých akcí přeměřena **klepnutím na stanovisko** ve čtyřech šířkách
  (320/360/390/430): 0 překryvů, 0 přetečení, hlavička **24 → 300 px**.

### ⚠⚠ Trojí past na měření vzhledu

Třikrát jsem se na snímku spletl a pokaždé mě opravilo až měření. Kdo bude
posuzovat vzhled ze snímků, ať si to přečte, ušetří si to hodinu:

1. **„Tlačítko překrývá jméno přístroje"** — byl to *zakázaný* prvek na 40 %
   krytí, přes který prosvítal text za ním. `getBoundingClientRect`: 0 překryvů.
2. **„V okně výsledku je velká prázdná díra"** — okno se odkrývá **po částech**
   (`setTimeout` po krocích). Snímek po 900 ms ukazuje díru, po 3 s je obsah
   celý (pod posledním prvkem 54 px u výhry i prohry). **Nic se neopravovalo.**
   ⚠ Ale při čekání 3,5 s se nad výsledek otevře okno „Nové oblasti" a nafotíš
   JE — je nutné ostatní `.ov.on` zhasnout.
3. **„Laborka a encyklopedie jsou prázdné"** — obrazovky **nejdou otevřít přes
   `show('lab')`**, obsah jim dodává až `renderLab()`/`renderCodex()`/
   `renderOpts()`. A `#bLab`/`#bCdx` sedí v podzáložkách `.lbSec`, které jsou
   `display:none`, dokud se neklepne na záložku v `#lbTabs`.

A jednou lhala i moje vlastní kontrola: po zavedení zalomení lišty hlásila
překryv, protože porovnávala prvky ze **dvou různých řad**. Kontrola překryvu
musí číst `r.top`.

### ⚠ Co se poučit ze slučování

- **⚠⚠ `git checkout --theirs` při rebase vrací TVOJI verzi, ne cizí.** Sáhl
  jsem po něm při konfliktu v `NAVOD.md` a tiše z něj vypadla celá cizí sekce
  o verzi 92. Konfliktní `.md` je jistější **postavit znovu** z
  `git show origin/main:<soubor>` a svoje přilepit nahoru.
- **✅ Vlastní worktree je jediné, co při tomhle souběhu fungovalo.** Za celý
  den ani jeden konflikt v kódu; pět rebase na cizí vydání, pokaždé jen řádka
  s verzí. Kdo dělá na `Desktop\geogame` spolu s ostatními, sdílí s nimi
  i **stagovací plochu** — `git worktree add` jako PRVNÍ krok.
- **⚠ Kontrola po rebase musí hlídat OBĚ strany.** Můj skript na `NAVOD.md`
  má seznam klíčových kusů od každé session a při jiném než jednom výskytu
  kotvy skončí — díky tomu se chytlo, že sekce 92 byla v souboru dvakrát.
- **⚠ Jednosouborovou kopii při rebase NEPŘEJMENOVÁVAT** — vyrobí to zbytečný
  rename/rename konflikt při každém kole. Dělá se až nakonec z hotového
  `index.html`.

---

## PŘEDCHOZÍ STAV: VERZE 93 (6. 9. odpoledne, session „obsah") — OBSAH ÚZEMÍ A FINÁLE

**Číslo 93 je moje.** Souběžně běžely další tři session a čísla jsme si rozdělili
zprávami: **92** balanc (capMax, slučování na ★, uzávěr etapy + dřívější commit
s příjmem a gravimetrem), **93** obsah (tenhle), **94** vizuál (oddělený worktree
`geogame-vizual-v93`, větev `vizual-v93` — jméno větve nese 93, ale vydávat bude
jako 94).

Pracuju ve **vlastním worktree** `C:\Users\stepa\Desktop\geogame-obsah-v93`,
větev `obsah-v93`, postavená na verzi 92 (ee2be80). Do sdíleného
stromu `Desktop\geogame` už nepíšu.

### Co je v mé půlce (a kde to při slučování hledat)

- `MAPS`: u každého území přibylo `boss:{...,"r":[...]}` a `mix:{...}`
- nová tabulka `RYS` + `bossRysy / finaleRysy / mixUzemi / casteVlivy` nad `const T={`
- `spawnAt` (rysy se věší na bosse), řádka pancíře v `hurt`, `shieldOf` + `S.covers`
- blok `if(e.k==='boss')` a řádka pohybu ve `step`, `S.rozptyl` ve `step` a ve `fire`
- `dveTrasy` (boss se už nedělí), poslední řádka `waveComp` (`return mixUzemi(l)`),
  hlášení rysů ve `startWave`
- texty: `EINFO`, záložky Vlivy a Pravidla v `renderCodex`, dva řádky v `#lvTer`,
  `QUIZ` z 36 na 60 otázek

**Vzhledu jsem se nedotkl** — ani řádka v CSS, v `draw`, `drawTower`, `buildBG`,
`terrainFull` ani v `PALS`. Na plátně po mně přibývají jen dva efekty typu `ring`,
které hra už používá.

**Balanc jsem nechal souběžné session.** `waveScale`, `capMax` ani ceny jsem
neotevřel. Dvě věci jsem si ale musel dovážit sám, protože je přinesl můj vlastní
obsah: **cenu rysu** (boss s rysem má o to nižší odolnost) a **násobek síly vlivu**
v územní směsi. Bez nich měřidlo ukázalo 8,0 proti 9,7 výhry z 12 — rysy i směs
byly tichý přídavek k obtížnosti. S nimi 9,7 proti 9,7. Územní směs vlivů drží váhu vlny (součet odolnosti) na původní hodnotě,
naměřeno ×0,99–×1,04 na dvanácti územích; A/B robotem po třech kolech dalo
**9,3 výher z 12 před i po**.

### Past, na kterou jsem doplatil (a ať na ni nedoplatí někdo znovu)

Vložil jsem 24 otázek na konec `QUIZ` a **poslední původní otázka končila bez
čárky** (`'}` a hned `{q:`). Tím přestal být platný JavaScript celý velký
`<script>`, hra se nespustila a `window.__G` nikdy nevzniklo — a protože v tom
souboru zrovna měřily další dvě session, spadla měření i jim. Načtení přes
`file://` hlásí jen `Unexpected token '{'` **bez čísla řádku**.

Jak se to najde rychle (od session 4c): vytáhnout velký `<script>` do samostatného
`.js`, v prázdné stránce ho vložit jako **inline** skript
(`el.textContent=src; head.appendChild(el)`) a poslouchat `window.onerror` — u inline
skriptu už číslo řádku přijde. Pak přičíst offset první řádky skriptu.

**Poučení:** při vkládání do pole vždy zkontrolovat, čím končí předchozí položka.
A po každém zásahu do sdíleného souboru ho **hned bootnout**, ne až na konci —
tenhle soubor sdílely tři session naráz.

---

## PŘEDCHOZÍ STAV: VYDÁNA VERZE 92 (6. 9. odpoledne) — GAMEPLAY

**Číslo 92 je vydané. 93 má session „obsah", 94 session „vizuál", další si berte 95.**

⚠⚠ **Dnes odpoledne jsme na hře pracovaly ČTYŘI session naráz** a tři z nich
psaly do TÉHOŽ pracovního stromu `Desktop\geogame`. Dohoda přes vzájemné zprávy
(`ListAgents` + `SendMessage`) fungovala, ale stálo to hodinu. Kdo příště najde
v `git status` cizí nezacommitované změny: **napřed se zeptej, kdo je autor**,
teprve pak sahej na soubor. Větev NEPOMŮŽE — `git checkout -b` mění jen ukazatel,
pracovní strom zůstává společný. Pomůže jedině `git worktree`.

### Rozdělení revírů, na kterém jsme se dohodly

| session | revír | verze |
|---|---|---|
| gameplay (tahle) | `capMax`, slučování na ★, uzávěr etapy, `plus` do snímku | **92** |
| balanc | `waveScale`, dotace v `endWave`, odměna za vliv, gravimetr, pásmo | (v 92) |
| obsah | `MAPS`, `RYS`, `mixUzemi`, `spawnAt`, `hurt`, bossové, texty, QUIZ | 93 |
| vizuál | `PALS`, `buildBG`, `terrainFull`, `drawTower` (vlastní worktree) | 94 |

### Co je ve verzi 92 (dva commity)

**Balanc (commit `2e6d54e`, cizí session):** příjem držel krok s vlnami (dotace
měla strop `min(wave,12)`, odměna za vliv nerostla vůbec, přitom odolnost vln
mezi 12. a 24. etapou roste 22×); násobek území platí od 1. etapy; křivka
odolnosti `(1+.44*(w-1))*1,10^(w-8)`; gravimetr neubíral vlivům s pancířem NIC
a uměl zaseknout etapu; pásmo mělo zdarma teodolitovu průbojnost.

**Gameplay (tenhle commit):**
1. **Uzávěr etapy.** Hra už `S.frontier` počítala (jak daleko se dostal nejhlubší
   vliv), ale NIKDO ji nečetl — její jediný konzument `openNewSpot()` se v celém
   souboru nevolá. Teď z ní má každá etapa výsledek a spojitou dotaci.
2. **Mistrovská řada ★ až ★★★** místo jediného kroku, ke kterému bylo potřeba
   osm přístrojů téhož druhu (robot na něj za celý běh došel 3× ze 70 etap).
   Druhá cesta je koupě — 260 / 900 / 1900.
3. **Kapacita čety má strop.** Rostla na 43–46 proti 8–14 postaveným
   stanoviskům, tedy za celý běh nikdy nic neomezila. Hlavní příčina: +1 za
   každé třetí sloučení bez stropu, ačkoli sloučení už samo místo uvolňuje.
4. **`plus` se ukládalo do snímku** — po POKRAČOVAT se mistrovská řada tiše
   ztrácela i s tím, co za ni hráč zaplatil. Změřeno: ★★ za 1 160 rozpočtu
   → po načtení 267 poškození místo 746.

### Čím je to podložené

- Čistá A/B mých změn proti HEAD (12 území × 3 kola, `mereni/ab.py`):
  **9,7 vs 9,7 výher z 12** — obtížností nehýbou. Etap, kde se ukazatel přesnosti
  vůbec hne: **9,3 % → 13,5 %**.
- Kapacita: podíl etap, kdy je četa plná, u hráče, který NESLUČUJE: **33 % → 51 %**.
  U hráče, který slučuje, zůstává skoro nulový (2 % → 6 %) — přesně ten tvar,
  o který šlo.
- Boot 0 chyb, jednotkový test mechanik i test uložení/načtení sedí.

⚠⚠ **Změnil jsem `mereni/bot.js`** — robot slučoval MIMO `boardTap` a připisoval
si četu podle vlastní kopie pravidla, takže po stropu vycházela kapacita 33 místo
17: měřil by stav, který ve hře neexistuje. Navíc teď umí kupovat ★. **Kdo má
rozměřeno starým robotem, čísla kapacity a pozdního rozpočtu proti novému
nesednou** — starý je `git show 7283539:mereni/bot.js`.

⚠⚠ **Past v měření, na kterou jsme naletěly dvě session nezávisle:** tvrzení
„rozpočet se v druhé polovině hromadí" (400–870 nevyužitých) je ARTEFAKT OKAMŽIKU
MĚŘENÍ. Log čte `S.cr` na KONCI etapy, tedy po příjmu a před stavební fází.
Po stavební fázi zbývá 40–260 — hráč utratí skoro všechno. Co platí, je že mu
docházejí VĚCI, na které utrácet.

⚠⚠ **Tvar obtížnosti zůstává binární** a globálním násobkem HP se to nespraví —
balancová session to změřila mřížkou 3×3 a vychází z toho čistá výměna výher za
ztráty 1:1. Pohnout s tím může jedině skladba vlny (`waveComp`), tedy pár vlivů,
které se nedají spolehlivě zastavit. To patří session „obsah".

### Doplněk k 92: prodej vrací i mistrovskou řadu

Vyšlo najevo až po vydání 92, opraveno tamtéž. **Kdo do stanoviska nalil
3 060 rozpočtu za ★★★, dostal při zrušení zpátky 107** — `sellVal()` počítá
základní cenu a kalibraci, o hvězdách nevěděl.

⚠⚠ **Naivní oprava „připočti hvězdy" je STROJ NA PENÍZE.** Hvězda ze sloučení
je zadarmo, takže by za ni prodej platil, aniž ji kdokoli koupil: sloučit dvě
pásma 4. řady (dohromady za 204) a výsledek prodat by s kartou *Výkup přístrojů*
dalo 362, tedy **+158 za kolo donekonečna**. Správně se pamatují **zaplacené
kredity** (`t.mistrCr`), ne počet hvězd — hráč pak nikdy nedostane zpátky víc,
než dal. Ověřeno třemi případy s kartou Výkup přístrojů: sloučená hvězda zdarma
−102 (ztráta, ne zisk), koupené ★★★ za 3 060 vrátí přesně 3 060, sloučení dvou
koupených ★1 sečte investici na 520 a nezdvojnásobí ji.

⚠ **Tatáž vada jako u `plus`:** `t.mistrCr` se muselo zvlášť dopsat do
`snapshot()` i `loadRun()`. **Kdykoli přidáváš stav na věž, projdi obě funkce** —
`snapshot()` má vlastní ruční seznam polí a tiše zahodí všechno, co v něm není.

### ⚠⚠ Sdílíme i STAGOVACÍ PLOCHU, nejen pracovní strom

Stalo se 6. 9. odpoledne a stojí za zapamatování: `git add` je ve sdíleném
stromě **sdílená akce**. Jedna session si `git add`la svoje soubory, druhá
o pár vteřin později přidala `git apply --cached` svůj jediný hunk a
commitla — a `git commit` vzal **celý index**, takže do jejího commitu spadly
i cizí `NAVOD.md`, `KOORDINACE-verze.md` a cizí změny v `index.html`.
Nic se neztratilo, ale commit nese popis, který o polovině jeho obsahu mlčí.

**Pojistka není „stageuj jen svoje hunky".** Ta nestačí, protože index už může
obsahovat cizí práci z dřívějška. Pojistka je **`git diff --cached --stat`
těsně před `git commit`** a podívat se, jestli tam nejsou cizí soubory.

⚠ `git update-index --cacheinfo` se v tomhle prostředí tiše neprojevilo —
spolehlivé je dočasně přepsat soubor svou verzí, `git add`, a hned soubor
vrátit zpět (pracovní kopie druhé session tím zůstane netknutá).

⚠ A po každém takovém zmatku ověřit **`cmp index.html geogame-vXX-jediny-soubor.html`**
— kopie se rozešla přesně o cizí hunk a na hostingu by ležela jiná hra než v repu.

### Hrdinové: síla za čtyři pole (druhé zadání uživatele k 92)

Uživatel: *„vybalancuj hrdiny tak, aby silou dali za 4 postavičky (zabírají
4 políčka)… ve výběru u decku si nemůžu rozkliknout ani vylepšit hrdinu…
a kalibrace je u hrdiny levná, tak ji zdraž, protože hrdina má být silnější
a speciální."*

**Naměřený výchozí stav** (odvedené poškození hrdiny proti průměru běžného
stanoviska, odehrané běhy, 12 území × 3 kola): dron **1,33**, rotační laser
**2,47**, mensula **0,65** stanoviska. Běh s hrdinou i bez něj vycházel na
11/12 výher — hrdina nepřidával prakticky nic a jen zabíral čtyři pole.
**Po vyvážení:** dron 3,8, rotační laser 3,6, mensula 2,8 (+ ~2 100 rozpočtu za běh).

⚠⚠ **Že „s hrdinou" a „bez hrdiny" vyjde po vyvážení STEJNĚ, je správný
výsledek, ne chyba.** Hrdina má stát právě za ta čtyři stanoviště, která
zabírá — takže když se výhry nezmění, je vyvážený přesně na svou cenu.
Metrika „kolik stanovisek zastane" je ta, která na tuhle otázku odpovídá;
počet výher na ni odpovědět neumí, protože u robota saturuje kolem 10,7/12.

⚠⚠ **Metrika je podíl na PEVNÉM koláči, takže saturuje.** Celkové poškození
za běh je dané odolností vln; když hrdina udělá víc, běžná stanoviska udělají
míň a průměr, kterým se dělí, klesne. Zdvojnásobení násobku proto zdaleka
nezdvojnásobí výsledek — z ×3,0 na ×6,2 se dron pohnul jen z 2,5 na 5,1.
Ladit iterativně a měřit, ne dopočítávat trojčlenkou.

⚠ **Mensula nemá málo poškození, má málo PŘÍLEŽITOSTÍ.** Jednocílový přístroj
s kadencí ~1/s od jisté hranice jen přestřeluje: při násobku 3,4 i 6,2 se
zastavila na 2,2 stanoviska. Pohnul s ní až násobek KADENCE — ten zároveň
zvedá její přísun do rozpočtu, tedy přesně to, čím má být.

⚠ **`treeFor()` vrací OBJEKT `{t1,t2,t3}`, ne pole.** Iterace přes něj
(`for…of`) shodí celý `openTinfo()` a okno se vůbec neotevře. Jména vylepšení
se musí hledat ve **všech** tabulkách `PERKS`, ne jen u svého druhu —
`markperm` má dron v `HPERK`, ale definovaný je u značkovacího druhu.

⚠ **Hrdinu nešlo do 92 vůbec rozkliknout** a `openTinfo()` u něj lhal:
ukazoval „cena" a „karet", ačkoli hrdina se nekupuje ze skladu ani nesbírá
karty. Navíc `ORD` hrdiny neobsahuje, takže je míjí i sběratelská obrazovka
a všechny cesty vylepšování přes karty. Roste jedině `hrdUpCost` přímo v měření.

**Kalibrace hrdiny** vychází z nasčítaných `up[]` (co už do něj hráč nalil),
ne z `priceOf*2^l` — hrdina nemá řady ze slučování, takže by ho ta mocnina
popisovala špatně. Plná kalibrace 662 → 1 648 (dron) až 1 918 (mensula),
zatímco běžné přístroje jdou po opravě soubežné session na 0,47–1,48násobek.

### ⚠⚠ Past v měřidle, které staví „co nejblíž trase"

Nález balancové session, ať na tom nikdo nestráví hodinu znovu: robot, který
umisťuje stanoviska podle pokrytí trasy, **systematicky podhodnocuje přístroje,
u kterých rozhoduje GEOMETRIE, ne blízkost.** Pentagon měří jen po své řadě
a sloupci — umístěný podle osy udělá o 40 % víc; kvadrant +42 %, protože se
dostane ze své mrtvé zóny. Podpůrné přístroje se stejným způsobem odepíšou jako
„nedělají nic", když stojí kousek za svým dosahem (hranol postavený 2,24 pole
daleko při dosahu 2,2). Se správným umístěním přidá hranol +12 %, GNSS +33 %,
termokamera +24 %, etalon +24 % — proti +13,5 % za deváté pásmo. **Roster je
v pořádku; chyba byla v měřidle.**

⚠⚠ **A druhá půlka téže pasti: „škoda na 1 rozpočtu" NEUNESE tvrzení „tenhle
přístroj je moc silný".** Balancová session jím naměřila, že hrdina (dron) je
8× nad křivkou — a pak si to sama vyvrátila odehraným během: 12 území × 2 kola,
jediný rozdíl přítomnost hrdiny, vyšlo **19/24 výher s ním proti 20/24 bez něj**
(průměrná přesnost 73,0 % proti 78,1 %). Hrdina tedy nepřidává nic, spíš mírně
škodí — zabírá čtyři stavební místa u trasy a rozpočet na jeho vylepšení nejde
do stanovisek, což měřidlo nevidí.

Příčina omylu: měřidlo staví cíle **nazmrzlo a hustě za sebou**, aby šlo sečíst
čisté poškození. To systematicky **nadhodnocuje všechno, co bije po ploše** —
a dron s pěti stroji, které pulzují každý zvlášť, je z toho nejcitlivější.

**Pravidlo, které z toho plyne:** „škoda na 1 rozpočtu" je dobrá na odhalení
přístroje, který nedělá NIC (tak se našel mrtvý gravimetr), a na srovnání téhož
přístroje se sebou samým (tak se našla past v kalibraci — nadhodnocení ploch
tam působí na obě strany stejně). **Na tvrzení „je moc silný" platí jedině
odehraný běh.**

⚠ **Syntaktickou chybu ve sdíleném souboru** (chybějící čárka mezi dvěma
položkami `QUIZ`) neodhalí `check_js` ani boot přes `file://` — ten hlásí jen
„Script error." bez čísla řádku. Funguje tohle: vytáhnout velký `<script>` do
samostatného `.js`, v prázdné stránce ho vložit přes
`el=document.createElement('script'); el.textContent=src; head.appendChild(el)`
a poslouchat `window.onerror` — inline skript už číslo řádku dá. Pak přičíst
offset první řádky skriptu (9873).

---

## PŘEDCHOZÍ STAV: VYDÁNA VERZE 91 (6. 9. ráno, session G) — PŘIPOMÍNKY HRÁČE

**Číslo 91 je vydané, další si berte 92.** Session G zapracovala připomínky
uživatele ke všem 49 obrazovkám verze 89.

⚠ **Verzi 90 mezitím vydala jiná session** (čtyři commity oprav: mrtvá epická
karta, popisky, odměny slibující hrdiny). Moje práce stála na verzi 89, takže
se musela **přesadit na jejich soubor** — všech sedm záplat naštěstí sedlo beze
změny kotev, jejich opravy se s vizuálem nepotkaly. Kdo bude příště vydávat:
`git pull --rebase` a `git log --oneline -5` na začátku, ne až na konci.

### Jak to vzniklo

Uživatel dostal prohlížečku všech 49 obrazovek (menu, 16 oken, všechny záložky
včetně šesti záložek panelu v měření) s hodnocením u každé. Vyplnil ji celou:
**48× „Předělat", 1× „Sedí"** (Nastavení). Jeho slova jsou doslova zapsaná
v pracovním souboru `ZADANI.md` v dočasné složce session.

Workflow: agent na globální čitelnost, pak sedm oblastí (terén, obchod,
vybavení+laborka, kariéra, encyklopedie, měření, okna), na každou skeptik.
15 agentů, žádný nespadl.

### Co našli skeptici a co jsem po nich spravil

- **Zamrzlý tutoriál**: schování rady veteránovi zastavilo i POSTUP tutoriálu,
  takže `SAVE.tut` zůstal na nule a výměna skladu byla **zdarma navždy**.
  Postup se teď počítá vždy, veteránovi se tutoriál jednou provždy zavře.
- **Náhled přístroje v obchodě zamrzl** po návratu na stránku (jeho smyčka
  končí na `PAGE!==0` a nikdo ji nerozjel). `goPage` ho teď nastartuje.
- Nadpis „Mapa světa" ležel na mapě (na 320 px zakrýval 5 z 12 jmen území).
- Křížek panelu měl 34 px místo 44, popisek „?" se vrátil, na 320 px se
  usekávaly názvy záložek.
- Mřížka denní odmény lezla na 320 px mimo okno; popisky v okně trofejní cesty
  se sekaly třemi tečkami; zamčený řádek pásu tlumil text krytím (4,28:1).

### Čím je vydání podložené

- 9 kombinací (320/390/1440 × den/noc/kontrastní) × dvě spuštění: **0 chyb**.
- Robot `mereni/ab.py`, tři kola: **8,0 vyhraných území z 12** proti 8,7 u verze
  90 — v rozptylu měřidla (jednotlivá kola 7/9/8 proti 9/9/8).
- Políčko desky 42 px na 390×844, stejně jako v 89 i 90.

---

## PŘEDCHOZÍ STAV: ČÍSLO 90 SI VZALA SESSION H (5. 9. pozdě večer) — OPRAVY, NE VZHLED

**Číslo 90 je zabrané, další si berte 91.** Session H udělala prohlídku hry
(report `Desktop\geogame-hodnoceni-v89.md`, známka 7,5/10) a pak opravila to,
co jde opravit **bez sáhnutí na vzhled** — vzhled si podle zadání uživatele
řeší jiná session.

Práce leží na větvi **`opravy-v90`**, na `main` zatím ne, právě proto, že
souběžně někdo přestavuje vzhled ve stejném souboru.

### Co je v 90

Sedm oprav, každá ověřená spuštěním a A/B proti v89 (podrobně v `NAVOD.md`):

1. **Hrdina se vejde na každé území.** Na mapách 4, 7 a 10 nebyl volný čtverec
   2×2 → hrdina tam nešel postavit vůbec. Nová `zajistiMistoProHrdinu()`
   v `newRun()` odkryje **nejmenší počet políček**, který jedno místo vyrobí.
   Změřeno: na těch třech mapách přesně **+1 políčko** (37→38, 34→35, 28→29),
   na zbylých devíti **beze změny**.
2. **Náhled při stavbě hrdiny** (`kresliMistaProHrdinu()`, volaná z `draw()`).
   Dosud se nekreslilo nic. Jde o **jednu volací řádku v `draw()`** a jednu
   samostatnou funkci — schválně tak, aby se to při přestavbě vzhledu dalo
   snadno přenést nebo přepsat.
3. `markperm` u dronu se četl jen u multistanice. Změřeno: značka **5 → 999**.
4. Filtr **Vše** u úspěchů: hotové vytlačovaly nesplněné ze stropu osmi karet.
   Změřeno při 13/25 hotových: **4 → 8** nesplněných vidět.
5. **Testovací režim** z druhého řádku Nastavení na konec.
6. Popisky tlačítek u **Co je nového** a **Zaseknutí a chyby**: VLOŽIT → UKÁZAT.
7. Texty **Důlního díla** a **Letecké plochy** tvrdily zákaz dronu, který ve hře
   není.
8. **Metody nespálí náboj za nic** (`useAbil`): čtyři metody působící na vlivy
   šlo použít na prázdnou trasu, Nivelační pořad při 100 % přesnosti — a hra
   ještě ohlásila zásah. Změřeno: náboje 2→1 před, 2→2 po.
9. **Rychlost 1×/2×/3×/4× se drží mezi měřeními** (`$('spd').onclick` zapisuje
   do `SAVE.opts.spd`). Dosud se volba psala jen do běhu.
10. **Náhled PŘÍŠTÍ na Rozcestí sítí** neuměl úpravu pro území se dvěma trasami
    a lhal v 12 z 12 etap. Nová `dveTrasy()` slouží náhledu i `startWave()`.
11. Tip o rozpočtu sliboval v ☰ obnovu přesnosti, která tam není.
12. Popisek **Hudba v menu** → **Hudba** (hraje i při měření).
13. Popisek **Výchozí rychlost** → **Rychlost měření**.

14. **Epická karta „Objížďka" nedělala nic** — jediný čtenář byl `S.detour`,
    který se nikde nenastavoval. Nabízela se v 2,4 % karet od 8. etapy a šla
    vzít dvakrát. Odstraněna z `CARDS`, dokud pro ni nebude poctivý účinek.
15. **Odměny za hvězdy 6 a 33 slibovaly HRDINU jako přístroj do sbírky**
    (`STARREW`, `tower:'mensula'` a `'rotlaser'`). Hrdinové nejsou v `ORD`,
    takže se ve sbírce ani v nabídce nikdy neobjeví — hráč dostal hlášku
    „nový přístroj" a nic. Nahrazeno kartami, stejně jako u trofejní cesty v 88.
16. **Pojistka v `applyReward()`**: odměna `tower`, která není v `ORD`, už
    nevypíše prázdný slib, ale dá karty. Kdyby to někdo zase napsal, projeví
    se to jako menší odměna, ne jako tichý podvod na hráči.

17. **Popisky příslušenství slibovaly 1,8× toho, co dávají** — všech dvanáct,
    poměr přesně 0,55. Změřeno na živých přístrojích (libela +8 % → +4,4 %,
    tilt +15 % → +8,3 %, thermo +10 % → +5,5 %, freq +12 % → +6,6 %).
    Sjednoceny texty, ne hodnoty; a doplněno „za úroveň“, které stálo jen
    u jednoho z dvanácti.
18. **Hranol 360°: první úroveň za 99 výzkumu nedělala nic.** Řetěz se počítá
    `for(j=0;j<=jumps;j++)`, takže 0,55 se ztratí — 3 zásahy před i po.
    Nově `max:1, cost:279, eff:{chain:1}`: tentýž koncový účinek i cena,
    bez slepé úrovně.
19. **Popisky synergií** — osm z deseti slibovalo víc (týž poměr 0,55).
20. **Rozpočet na konci etapy mohl být zlomkový** (Radiomodem dává 2,2 za
    stanici) → „+18.2 rozpočtu“. `bonus=Math.round(bonus)` před přičtením.
21. **Karta Předsunuté stanoviště nedělala, co slibuje** — text „hned uvolní
    dvě místa u trasy“, kód `+2*M('fwd')` do `capMax()`, tedy duplikát běžné
    karty Terénní četa. Změřeno: odkrytých 62 → 62, kapacita 6 → 8. Nově
    volá `openNewSpotForce()` dvakrát ve výběru karet (62 → 64) a do kapacity
    nesahá. **Pozor:** `fwd` teď nemá čtenáře přes `M()`, takže ho hledač
    mrtvých id hlásí falešně.
22. Karta **Výkonné baterie** slibovala dronům +25 % doletu i rychlosti;
    rychlost dostává 15 %.

**Nechalo se být (je to vyvážení, ne vada):** hodnoty příslušenství a synergií
zůstaly na 0,55násobku původního slibu — vrátit je nahoru je rozhodnutí
o obtížnosti. A karta Rozhledny dá auře GNSS 12 %, zatímco dosahu ostatních
přístrojů 7 %; hráč tam dostává **víc**, než mu popisek slibuje, takže se to
nechalo a v kódu je u `auraR()` poznámka, aby to nikdo neopravil mimochodem.

**Ověřeno bez nálezu** (ať to nikdo nehledá znovu): uložení a obnova
rozehraného měření (0 rozdílů ve 12 sledovaných hodnotách), strop nábojů,
vrácení stanoviska, ceny vylepšení hrdiny, výměna nabídky během tutoriálu,
počítadla všech dvanácti denních úkolů, **všech 78 vylepšení** přístrojů
i hrdinů (u hrdinů i to, že se čtou ve větvi jejich druhu — tam selhával
`markperm`), 5 vylepšení sítě, 7 metod, 10 účinků příslušenství, **6 trvalých
vylepšení**, dosažitelnost všech 20 přístrojů, **36 otázek kvízu**, obsah čtyř
druhů beden a **83 prokliknutých ovládacích prvků** v menu na plně odemčeném
profilu.

### Čeho se session H NEDOTKLA (patří vzhledové session)

Paleta desky (`PALS`, `theme:'day'`), kreslení stanovisek a vlivů, draft karet,
výsledková obrazovka a konfety, CSS (ani jedno pravidlo), rozložení pro užší
displeje. **V CSS bloku není jediná změna** — kdo dělá vzhled, může merge brát
bez obav o styl.

### Kde se to potká

`index.html`: `newRun()`, `draw()` (jedna volací řádka), `updateDrones()`,
`renderOpts()`, `renderAch()`, `hoverFrom()`, dvě položky v `MAPS`, `const VERZE`
a text „Co je nového". Nic z toho není v CSS.

---

## PŘEDCHOZÍ STAV: VYDÁNA VERZE 89 (5. 9. večer, session G) — PŘESTAVBA SESAZENA

**Číslo 89 je vydané, další si berte 90.** Session G (tahle) dodělala práci,
kterou po sobě nechaly session E a F, a vydala ji.

### Co se dodělávalo

**Session E** (vizuální přestavba, dopoledne) rozdělila práci na deset záplat
a deset CSS bloků v dočasné složce, všechny je dopsala — a **nikdy je nesesadila
ani nespustila**. `sestaveno.html` byla jen nedotčená kopie zdroje.
**Session F** mezitím zapsala do `index.html` opravy kontrastu a taky je
nevydala. Obě práce se musely nejdřív složit dohromady:

- dvě kotvy záplat (`40-teren`, `50-laborka`) mířily na text, který session F
  mezitím přepsala (`opacity:.6` → `.8`, `opacity:.75` → `.9`);
- záplata `25-skiny.py` měla **utržený řádek** — `zlato: {n:'Zlatá', col:'#ffd busted`
  — který lámal **celý JS hry**: `window.__G` nebylo vůbec definované a hra se
  nespustila. Doplněno z ověřeného mezivýstupu té session (`work/25/out.html`).

### Jak se to ověřovalo

Workflow: sedm oblastí (lišta a titulka, obchod, vzhledy přístrojů, vybavení,
terén, laborka + kariéra, hra + okna), na každou kontrolor a nad ním skeptik,
který má nálezy **vyvracet**. Kontroloři směli opravovat **jen ve vlastním CSS
bloku** (`blocks/9NN-oprava.css`), aby si navzájem nepřepsali práci; zásahy do
JS a HTML museli popsat kotvou a nechat hlavní session. 10 agentů ze 13 doběhlo,
tři spadly na limit session — jejich měření ale zůstalo ve scratchpadu a dalo
se dočíst.

**Ze skeptiků vzešly dvě opravy měřidel, ne hry:** kontrast počítaný z vrstev
CSS hlásil 4,39:1 tam, kde diferenční měření dvěma snímky dává 4,92:1, a jedna
oprava kontrastu si vyrobila **regresi** (popisek pruhu postupu na legendární
kartě spadl z 8,71 na 1,95:1), kterou původní měřidlo nemohlo vidět — `<span>`
je sourozenec výplně, ne její potomek.

### Co je v `index.html` navíc proti bloku session E

Jedna nová záplata `90-opravy.py` (jen JS a HTML, každá kotva ověřená spuštěním):
obnova záložky Za mezníky v `renderShop()`, vzhledy jen k odemčeným přístrojům,
zdvojené „Nasazeno", dvojnásobné míchání barvy rodiny s barvou přístroje,
zmenšený prstenec v mapě světa, filtr Vše u úspěchů, sladěná `theme-color`
s pozadím a text Co je nového.

Sesazecí sada (záplaty a CSS bloky) byla **jen pracovní** a v repozitáři není —
`index.html` je od téhle chvíle zase jediný zdroj pravdy a další úpravy patří
přímo do něj.

### Čím je vydání podložené

- 9 kombinací (320/390/1440 × den/noc/kontrastní) × **dvě spuštění** téhož
  profilu: **0 chyb v konzoli**, 0 vodorovných přetoků.
- Robot `mereni/ab.py`: **222 odehraných etap, 9 vyhraných území z 12** proti
  8 z 12 ve verzi 88 — obtížnost se přestavbou neposunula.
- Políčko desky 42 px na 390×844, stejně jako v 88.

### Co zůstává nedodělané

Sepsáno v `NAVOD.md`, oddíl **Co zůstává na příště**. Nejdůležitější:
**oblast „hra a okna" nemá druhé čtení** — skeptik se k ní kvůli limitu session
nedostal, takže tři tamní opravy stojí jen na měření kontrolora.

---

## PŘEDCHOZÍ STAV: VYDÁNA VERZE 88 (5. 9. ráno, session D) — A REPO JE KONEČNĚ GIT

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
