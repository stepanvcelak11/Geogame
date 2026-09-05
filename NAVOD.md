# GeoGame — verze 90

## Co nahrát na hosting

Všech osm souborů do kořene repozitáře, vedle sebe (ne do složky):

| Soubor | K čemu |
|---|---|
| `index.html` | hra |
| `sw.js` | offline režim |
| `manifest.webmanifest` | jméno, ikony, celá obrazovka |
| `icon-192.png`, `icon-512.png` | Android a Google Play |
| `icon-512-maskable.png` | adaptivní tvar ikony |
| `apple-touch-icon-180.png` | ikona pro iOS plochu |
| `icon.svg` | vektorová záloha |

**GitHub → repozitář → Add file → Upload files → vybrat všech osm → Commit changes.**
Poté Settings → Pages → větev `main`, složka `/ (root)` → Save.
Za minutu poběží na `https://tvoje-jmeno.github.io/nazev-repa/`.
V Chromu pak tři tečky → **Přidat na plochu**.

## Aktualizace

Nahraj nový `index.html` a `sw.js` se stejnými názvy. Nová verze se stáhne při dalším
spuštění s internetem a projeví se po zavření a otevření hry. Ručně:
**Nastavení → Zkontrolovat aktualizaci**. Číslo verze je dole pod mapou světa
a v hlavičce Nastavení.

Číslo verze se od verze 82 píše na **jediné místo** — `const VERZE=90;` v `index.html`.
Odtud se rozsype do stránky i do adresy, kterou se registruje `sw.js`. Jinam se nesahá.

## Bez hostingu

`geogame-v90-jediny-soubor.html` stáhni do telefonu a otevři v Chromu.
Funguje offline, jen se sám neaktualizuje.

Od verze 82 je tenhle soubor **přesná kopie `index.html`**. Hra si sama pozná, že běží
ze staženého souboru, a manifest si přepíše. Novou verzi tedy vyrobíš prostým zkopírováním
a není co udržovat dvakrát:

```
copy index.html geogame-v90-jediny-soubor.html
```

## Záloha postupu

**Nastavení → Záloha postupu → ZKOPÍROVAT**, v cílové verzi **Obnovit ze zálohy**.
Potřeba při přechodu mezi staženým souborem a hostovanou adresou nebo mezi zařízeními.

Od verze 82 si hra sama drží záchrannou kopii postupu:

- Když se hlavní uložení poškodí, hra ho **nepřepíše** — načte kopii a v Nastavení
  nabídne, co dál (**Nečitelný uložený postup**).
- Když se ukládání nedaří, protože v zařízení došlo místo, řekne to hláškou
  místo tichého selhání.
- Po vložení zálohy jde vrátit předchozí stav: **Nastavení → Vrátit obnovu**.

## Co je nového ve verzi 90

Opravné vydání, **šestnáct oprav**. Nic nového se nepřidávalo, jen se spravilo,
co bylo rozbité — včetně věci, která na třech územích brala hráči celého
hrdinu, a čtyř metod, které se daly spálit za nic. **Vzhledu se tahle verze
nedotýká**, ten řeší jiná session.

- **Hrdina se už vejde na každé území.** Na Městské zástavbě, Železničním
  koridoru a Mostní konstrukci nebyl ve vytyčeném pásu ani jeden volný
  čtverec 2×2, takže tam hrdina nešel postavit vůbec a hráč o něj pro celé
  území přišel. Když místo chybí, odkryje se **nejmenší počet políček, který
  jedno vyrobí**, a jen u trasy (stejný strop jako u ostatního odkrývání).
  Změřeno: na těch třech územích **přesně jedno políčko navíc**
  (37→38, 34→35, 28→29), na zbylých devíti se nezměnilo nic. Platí pro toho
  hrdinu, kterého má hráč nasazeného — ověřeno pro všechny tři.
- **Při stavbě hrdiny je vidět, kam se vejde.** Dosud se nekreslilo nic:
  hráč dostal pokyn „klepni na desku" a měl na desce 9×13 najít čtverec 2×2,
  který se nikde neoznačoval — a na Železničním koridoru i na Mostní
  konstrukci je takové místo **jediné**. Teď svítí všechna možná místa a pod
  prstem se ukáže přesně ten čtverec, kam hrdina dosedne. Náhled používá
  **stejné pravidlo rohu jako skutečné klepnutí**, takže nelže o půl pole.
- **Trvalé vytyčení z poslední řady dronu funguje.** Četlo se jen v obsluze
  multistanice, takže hrdinovi ta schopnost nedělala nic. Změřeno na živém
  vlivu: značka **5 → 999**.
- **Kariéra → Úspěchy, filtr Vše** ukáže i nesplněné úspěchy. Hotové mají
  postup 100 %, řadily se proto nahoru a strop osmi karet zabraly celý.
  Změřeno při 13 z 25 hotových: z osmi vidět **4 nesplněné → 8**.
- **Testovací režim** (odemkne všechno) se přesunul na konec Nastavení.
  Byl druhá položka odshora, hned pod Vzhledem.
- Tlačítko u řádku **Co je nového** a **Zaseknutí a chyby** říkalo VLOŽIT —
  dědilo se z poslední větve popisků. Teď říká UKÁZAT.
- **Důlní dílo** a **Letecká plocha** měly v popisu, že tam nelétá dron.
  Ten zákaz ve hře není; na Důlním díle je zakázané jen GNSS.
- **Měřická metoda už nespálí náboj za nic.** Protínání vpřed, Polygonový
  pořad, Uzávěr pořadu a Vytyčení bodů šlo použít na **prázdnou trasu**
  a Nivelační pořad při **stoprocentní přesnosti** — náboj se odečetl a hra
  ještě oznámila zásah, který se nekonal („Protínání vpřed · zásah 45" bez
  jediného vlivu na desce). Změřeno: náboje **2 → 1** před, **2 → 2** po.
  Metoda teď řekne proč a náboj zůstane.
- **Rychlost si hra pamatuje.** Tlačítko 1× / 2× / 3× / 4× zapisovalo volbu
  jen do rozehraného měření, takže na dalším území byla zase jednička.
  Změřeno: po klepnutí `SAVE.opts.spd` **1 → 2** a další měření startuje
  na 2×. Nastavení proto říká **Rychlost měření**, ne „Výchozí rychlost".
- **Náhled PŘÍŠTÍ na Rozcestí sítí lhal ve všech dvanácti měřených etapách.**
  Území se dvěma trasami posílá menší vlny (×0,62), ale náhled o tom nevěděl:
  sliboval 11 vlivů a přišlo 7. Náhled i skutečná vlna teď počítají touž
  funkcí `dveTrasy()`. Změřeno: neshod **12/12 → 1/12**, a ta zbylá je
  vylosovaná podmínka etapy, kterou náhled hlásí zvlášť jako „možné podmínky".
- **Tip o rozpočtu** sliboval, že v panelu ☰ je „obnova přesnosti" — ta tam
  není, jsou tam jen Terénní služby (posílení čety) a vylepšení v záložce Síť.
- Nastavení: **Hudba** hraje i při měření (a u bosse zrychlí), popisek přitom
  tvrdil, že jen v menu.
- **Epická karta Objížďka nedělala nic.** Jediné, co ji četlo, byl `S.detour`,
  který se nikde nenastavoval. Změřeno: nabízela se v **2,4 % karet** od osmé
  etapy (29 z 1200 vylosovaných), byla epická a šla vzít dvakrát — pokaždé
  hráč přišel o jeden ze tří výběrů. Navíc slibovala, že vlivy startují **blíž**
  nulovému bodu, což je postih, ne odměna. Z nabídky zmizela, dokud pro ni
  nebude poctivý účinek.
- **Odměny za hvězdy slibovaly hrdiny.** Za 6 hvězd hra oznámila „nový přístroj:
  Měřický stůl" a za 33 hvězd „Rotační laser" — jenže hrdinové nejsou ve sbírce
  ani v nabídce a odemykají se pohárem (400 a 1150), ne hvězdami. Hráč tedy
  dostal hlášku a nic. Dvě karty, které se k tomu přidávaly, byly rovněž
  k ničemu. Nově dávají karty: **6 hvězd 120 výzkumu + 8 karet**, **33 hvězd
  Etalonový sejf + 600 výzkumu + 16 karet**. Šest hvězd má hráč po dvou
  územích na tři hvězdy, takže na tuhle vadu narazil skoro každý.
  Aby se to nemohlo tiše vrátit, `applyReward()` nově pozná odměnu mimo sbírku
  a místo prázdného slibu dá karty.

### Ověřeno bez nálezu

Tyhle věci prošly zkouškou v pořádku, ať je nikdo nehledá znovu:

- Uložení a obnova rozehraného měření — mapa, etapa, přesnost, rozpočet,
  stanoviska, hrdina včetně velikosti, odkrytá pole, síť, náboje, kapacita:
  **0 rozdílů**.
- Doplňování nábojů na konci etapy respektuje strop; vrácení stanoviska vrátí
  rozpočet i kapacitu; ceny vylepšení hrdiny 60/150/340 a pak MAX; výměna
  nabídky je během tutoriálu zdarma a popisek to říká.
- Všech dvanáct druhů denních úkolů má funkční počítadlo.
- **Všech 78 vylepšení** přístrojů i hrdinů se opravdu čte — a u hrdinů navíc
  v té větvi kódu, která k jejich druhu patří (přesně tam selhávalo
  `markperm`). Stejně tak 5 vylepšení sítě, 7 měřických metod a 10 účinků
  příslušenství.
- **Všech 6 trvalých vylepšení** (Provozní záloha, Stálý tým, Etalon,
  Rychlonabíjení, Vlastní dílna, Grantové oddělení) se skutečně promítá do hry,
  ne jen do popisku.
- Každý ze 20 přístrojů ve sbírce jde získat a žádná odměna už neslibuje nic,
  co ve sbírce není. Každý druh přístroje má vývojový strom.
- **36 otázek kvízu**: platný index správné odpovědi, žádná se neopakuje,
  žádné dvě stejné možnosti, všechny mají vysvětlení.
- Čtyři druhy beden dávají rozumně odstupňovaný obsah (10 karet / 26 výzkumu
  až 59 karet / 320 výzkumu).
- **83 ovládacích prvků** ve všech pěti stránkách menu proklikáno na plně
  odemčeném profilu — **0 chyb**.

### Co zůstává na příště

Čtyři největší nálezy z prohlídky 5. 9. večer jsou vizuální a tahle verze se
jich nedotkla — deska vypadá jako z jiné hry než menu, draft karet vypadá jako
seznam, konfety se na výsledku kreslí přes text a deska se scvrkává na
telefonech užších než 390 px. Rozepsané jsou v `Desktop\geogame-hodnoceni-v89.md`.

## Co je nového ve verzi 89

Velká vizuální přestavba do podoby moderní mobilní hry. Herní pravidla se
nezměnila (robot dohraje stejně jako v 88: 9 vyhraných území z 12 proti 8),
změnilo se, jak hra vypadá a jak se v ní hledá.

- **Nový výtvarný systém.** Karty místo barevných ploten, tmavá deska, jedna
  stupnice odsazení a zaoblení a jeden barevný akcent na kartu. Popis systému
  je v hlavičce stylu (blok `00 - VYTVARNY SYSTEM`); kdo bude přidávat další
  obrazovku, má se ho držet, jinak se to zase rozpadne do duhy.
- **Terén je poskládaný do čtyř zastávek** — mapa světa, profil, úkoly a režimy
  ve vodorovném pásu — místo jedenácti bloků pod sebou.
- **Vzhledy přístrojů zvlášť na každý přístroj.** Dosud byl jeden vzhled
  globálně pro všech dvacet. Teď má každý přístroj tři vlastní, dohromady 69,
  a barva rodiny se míchá s barvou přístroje. Míchání bylo tak slabé, že svůj
  účel neplnilo (163 z 278 dvojic přístrojů v téže rodině mělo odstup barvy
  pod 12 v RGB, nejtěsnější 3) — zdvojnásobilo se, teď je takových dvojic 52
  a rodina zůstává poznat.
- **Co jsi měl koupené pro všechny přístroje najednou, máš dál.** Starý vzhled
  se převede na všechny přístroje; kde ta rodina není, dostaneš vzhled ze stejné
  cenové police. Vedlejší účinek: kdo měl koupené všech pět starých rodin, má
  rovnou všech 69 nových a v obchodě už nemá co kupovat. Je to vědomé
  rozhodnutí — hráč nemá přijít o to, co si zaplatil.
- **Vzhled se dá koupit jen k přístroji, který už máš.** Na čerstvém profilu
  nabízela karuselka všech 23 přístrojů, ačkoli hráč jich má 7, a vzhled šlo
  opravdu koupit za 80 mezníků k přístroji, který nikdy neviděl.
- **Spodní lišta a tlačítko HRÁT se už nepřekrývají** (dřív o 16 px).
- **Trofejní i sezónní cesta se rozklikne** a odměny jsou pilulky, ne holý text.
- **Čitelnost.** Desítky míst, kde bylo světlé písmo na světlé ploše — nejhorší
  poměry 1,0–2,5:1, měřeno proti skutečně vykresleným pixelům. Nejvíc jich bylo
  v kontrastním motivu: tlačítko panelu v bitvě mělo v něm poměr 1,00 (černý
  glyf na černé ploše), pilulka postupu sezónní cesty rovněž 1,00.
- **Dotykové cíle** mají všude aspoň 44 px (jen na stránce Vybavení jich bylo
  26 menších).
- **Obchod → Za mezníky** ukazuje po návratu na stránku skutečný zůstatek
  (dřív dvě různá čísla téhož účtu na jedné obrazovce) a tlačítko, na které
  hráč nemá, je vypnuté — dosud šlo klepnout a nestalo se vůbec nic.
- **Kariéra → Úspěchy: filtr Vše** konečně ukáže i hotové úspěchy. Dosud dělal
  přesně totéž co Nesplněné.
- **Prstenec kolem území, kam se právě jde**, není useknutý okrajem mapy —
  týkalo se to prvního území, které vidí každý nový hráč.
- Hrací deska zůstala stejně velká jako v 88 (políčko 42 px na 390×844).

### Co zůstává na příště

- **Oblast „hra a okna" nemá druhé čtení.** Kontrolor ji proměřil a tři nálezy
  opravil, ale skeptik, který má nálezy vyvracet, se k ní už nedostal. Sama
  bitva je proto ověřená jen spuštěním (222 odehraných etap, 0 chyb v konzoli),
  ne prohlídkou.
- Na záložce **Za mezníky** jsou v DOM pořád dva „hlavní" prvky proti pravidlu
  systému; ztlumil se jen ten druhý.
- **Odměny za hvězdy** v Kariéře zůstávají holým textem. Pilulky by blok
  natáhly ze 455 na 804 px, takže to chce dřív užší pilulky nebo dva sloupce.
- Na šířce **320 px** se do horní lišty pořád nevejde jméno delší než sedm
  znaků a denní zakázka není celá vidět ani po dorolování.
- Jedno pravidlo v obchodě stojí na CSS `:has()`; na iPhonu se systémem starším
  než iOS 15.4 se zahodí a patní poznámka tam zůstane viset.

## Co je nového ve verzi 88

Oprava nálezů z prohlídky verze 87. Nic nového se nepřidávalo, jen se spravilo,
co bylo rozbité — včetně dvou věcí, které braly hráči postup.

- **Uložený postup už se při druhém spuštění nevynuluje.** Kontrola uložení
  přidávaná ve verzi 85 brála úrovně přístrojů, úrovně příslušenství a bestiář
  jako číslo a jako seznam, ačkoli to jsou seznamy dvojic. Při každém dalším
  otevření hry je proto smazala a uložila prázdné. Změřeno před a po:
  `lvl` bylo po restartu `0`, teď zůstává `{theo:3, nivel:2, tape:1}`.
- **POKRAČOVAT vrátí hrdinu celého.** Uložený bod si nesl jen klíč přístroje,
  ne velikost, takže se hrdina po načtení rozehrané hry scvrkl na jedno pole,
  měřil z rohu místo ze středu a tři pole se uvolnila ke stavbě.
- **Zamrznutí:** chyba v kroku hry už nezastaví kreslení (dosud se přeskočil
  celý zbytek snímku včetně `draw()`, takže obraz zatuhl, i když smyčka běžela),
  naplánování dalšího snímku je nově ve `finally` a pád při startu už nenechá
  hru bez smyčky. Chyby **mimo snímek** (kliknutí, odpočty, sliby) se teď také
  zapisují do **Nastavení → Zaseknutí a chyby** a hláška se ukáže i v menu,
  ne jen v rozehraném měření.
- **Úspěch Kompletní výbava** chtěl 21 přístrojů, ale po přesunu tří hrdinů
  mimo běžnou nabídku jich je 20 — nedal se splnit, a s ním ani 25/25 úspěchů.
- **Trofejní cesta za 660 pohárů** slíbila fotogrammetrický dron, který je
  teď hrdina a ve sbírce by se nikdy neukázal. Místo něj dává karty a výzkum.
- **Počet stanovisek** v tipu a v řádku Síla sestavy už nepočítá hrdinu, který
  kapacitu nezabírá — sedí to s HUDem.
- Efekt **ZKUŠENOST** se hrdinovi kreslil do levého horního rohu místo do středu.

### Co zůstává na příště

- ~~Na třech územích není volný čtverec 2×2 pro hrdinu; `markperm` u dronu
  nikdo nečte; náhled při stavbě hrdiny; dvě území lžou o zákazu dronu.~~
  **Všechno opraveno ve verzi 90.**

## Co je nového ve verzi 87

- **Hrdinové.** Do měření si bereš právě jednoho: **fotogrammetrický dron**
  (máš ho od začátku), **rotační laser** (od 400 pohárů) nebo **měřický stůl**
  (od 1150). Postavíš ho zdarma hned v první etapě, zabírá **čtyři pole**
  a **nedá se sloučit ani prodat** — roste jen vylepšením za rozpočet
  (tři placená vylepšení: dron 60 → 150 → 340, rotační laser 65 → 165 → 370,
  měřický stůl 70 → 175 → 395) a s každou řadou mu přibude schopnost, ne jen číslo:
  dron rozšíří roj a nakonec i bombarduje, laser přidá druhý paprsek a brzdu,
  stůl zdvojnásobí výdělek a začne platit paušál za etapu.
- Tyhle tři přístroje proto **zmizely z běžné nabídky**. Nasbírané karty
  a úrovně se jednorázově přepočetly na výzkum, takže se nic neztratilo.
- **Pentagonální hranol** — nový přístroj, který měří **výhradně v pravém úhlu**:
  po své řadě nebo po svém sloupci, a rána projde celou přímkou a zasáhne
  všechno na ní. Šikmo nevidí vůbec nic. Odemyká se na Rašeliništi.
- **Gravimetr** — v místě zásahu vyrobí tíhovou anomálii, která vlivy **táhne
  zpátky po trase**, brzdí je a průběžně ubírá. Odemyká se na Železničním koridoru.
- **Hra už nezamrzne.** Jediná chyba uvnitř snímku dřív zabila celou kreslicí
  smyčku — obraz zamrzl, tlačítka přestala reagovat a hru šlo jen vypnout
  a zapnout. Teď se chyba zapíše do **Nastavení → Zaseknutí a chyby** a hraje
  se dál. Stejně tak se sám zavře panel, který zůstal viset a držel stránku
  zamčenou.
- **Dole na displeji už nesvítí modrý pruh.** V hlavičce byly dvě značky
  `theme-color`; prohlížeč bral tu první (`#0b1030`), zatímco hra přepínala
  tu druhou, kterou nikdo nečetl. Zbyla jedna a sedí s pozadím hry.
- **Ovládání je nižší, deska vyšší.** Změřeno na 390×844: políčko 38 → 41 px,
  deska zabírá 59 → 63 % výšky obrazovky, ovládání ubralo 208 → 176 px.
- **Nouzová oprava přesnosti jde koupit až po skončení etapy.** Uprostřed vlny
  z ní byl ventil, kterým se dal každý průnik hned zaplatit.
- **Kratší dostřel** u všech přístrojů (zhruba o 12 %) a **strop na to, kolik
  se dá dosah vynásobit dohromady**. Karta Rozhledny, síť, hranol, GNSS a strom
  se dřív násobily bez omezení až na trojnásobek základu, což na desce 9×13
  znamená „vidím všude" a umístění přestane rozhodovat.
- **Karty po etapě dávají míň**: poškození +12 → +9 %, dosah +10 → +7 %,
  rychlost +10 → +8 %, dvojnásobná rána +12 → +8 %, bonusy proti druhům vlivů
  o čtvrtinu až třetinu dolů. Naměřeno robotem: 10 z 12 území dohraných
  před i po, ale zbylá přesnost se rozprostřela (dřív šestkrát 100 %,
  teď 44 až 100 %) a ukazatel přesnosti se hne v 14 % etap místo 9 %.

## Co je nového ve verzi 86

- **Hrací deska je velká.** Nápověda tutoriálu a lišta vybraného stanoviska
  si ukrajovaly z výšky desky a políčko kvůli nim spadlo ze 42 na 25 px.
  Nápověda teď desku překrývá stejně jako panel a pruh pro lištu se drží,
  jen když ta lišta opravdu je.
- **Terč na konci trasy má popisek NULOVÝ BOD**, začátek trasy **ODSUD**.
  Byla to jediná věc na desce, o kterou jde prohra, a neměla vysvětlení.
- **Měřická čísla stanic z cesty zmizela.** Byla to ozdoba, ale hráč je četl
  jako údaj; jedno padalo těsně vedle terče a vypadalo jako odznak na něm.
- **Výběr měřické metody ukáže všech sedm.** Dřív jen ty, které hráč umí —
  o zbylých pěti se nedalo dozvědět, že existují. Zamčené jsou šedé a je
  u nich napsáno, ve které oblasti a za kolik pohárů se odemknou.
- **Okno území zhublo.** Mělo čtyři vždy otevřené sekce a pět velkých tlačítek
  pod sebou; hlavní akce byla až čtvrtá. Teď je nahoře sestava a hned pod ní
  start, zadání a cíle se rozbalují jedním řádkem a další režimy mají
  vlastní blok.

## Co je nového ve verzi 85

- **Mezníky** — druhá měna. Nedá se koupit ani nepadá z beden: dostaneš ji za tři
  hvězdy na území, za splněné denní úkoly, za zkoušku na plný počet a se 6% šancí
  ji najdeš po dokončeném měření. Kupuje **čas a vzhled, nikdy sílu** — síla se dál
  platí výzkumem, jinak by se ekonomika Laborky rozpadla.
- **Vzhledy přístrojů**: šest materiálů (tovární, terénní oranžová, noční šedá,
  muzejní mosaz, karbon, kamenný mezník). Mění barvu těla, obrysu i lesku — proto
  vypadají jako jiný odlitek, ne jako přebarvená ikona. Žádný obrázek navíc.
- V obchodě je záložka **Za mezníky**: balíček 200 výzkumu za 40, nejvýš jednou denně.
- **Sbírka je rovnou na stránce Vybavení**, hned pod sestavou. Samostatná obrazovka
  i tlačítko, které ji otvíralo, zmizely.
- **Stránky se jmenují podle toho, proč tam chodíš**: Obchod · Vybavení · Terén ·
  Laborka · Kariéra. Trvalá vylepšení se přestěhovala do Laborky.
- **Mapa světa je první věc na Terénu.**
- **Profil ožil** — medaile, hodnost a tři údaje v pilulkách místo jednoho řádku.
- Velikost písma jde zvětšit o 15 nebo 30 %, deska má tři opravdové stupně velikosti
  a na notebooku se ovládání složí vedle desky.

## Co je nového ve verzi 84

- **Tmavý povrch místo světlého.** Změřeno: syté barvy zabíraly 53 % obrazovky
  a na jedné stránce jich soupeřilo šest až sedm. Teď je světlých ploch 16 % a barva
  zbyla tam, kam patří — na tlačítko, na měnu a na vzácnost.
- **Spodní lišta**: ikony měly kontrast 2,6 : 1 (v kontrastním motivu 1,7 : 1), protože
  dvě pravidla se stejnou specificitou si přebíjela barvu. Vybraná záložka teď vystoupí
  nad lištu.
- **Mapa světa** je o dvě třetiny větší, jde ke krajům a je v soumraku. Zamčená území
  byla dřív světlejší než okolí, takže oko tahalo tam, kam se klepnout nedá. Jméno se
  ukazuje jen u území, kam se dá jít — dvanáct cedulek se nevešlo a překrývaly se.
- **Karty v obchodě**: ikona přístroje ležela na pozadí téže barvy, tedy kontrast
  1,00 : 1. Teď svítí z tmavého kotouče.
- **Bedny jsou jen ve Skladu** a odpočet u nich běží (dřív se překresloval jen ten
  na stránce Bitva, proto ve Skladu stál).
- Ukončit měření se přesunulo z křížku do nabídky pod ☰; z hrací plochy zmizely
  souřadnice a nápis, které v ní ležely.
- Obtížnost: přesnost klesá plynule podle toho, kolik vlny projde, vlny nerostou
  na konci tak strmě a v Nastavení přibylo **Omezit pohyb**.

## Co je nového ve verzi 83

- **Stavět jde na každé pole, které sousedí s trasou** — i rohem. Konec náhodného
  odkrývání: místo šesti políček jich je podle území 28 až 69 a vytyčený pás je
  na desce vidět (oranžová přerušovaná hranice, mezníky).
- Slučování a terénní služby už neotvírají pole, ale posilují **četu** (+1 stanovisko).
  V HUDu je proto jedno číslo: `5/12 stanovisek`.
- Nový vzhled: všechno je odlité z plastu, pozadí je měřická deska, nadpisy mají
  ražený obrys, značky přístrojů se kreslí ve třech průchodech.
- Čitelnost: 47 míst mělo text v barvě s kontrastem pod mezí (rozpočet 1,4 : 1).
  Teď je pod mezí nula, měřeno na skutečně vykreslené hře ve všech třech motivech.

## Co je ve hře

12 území s vlastními bossy · 20 přístrojů + 3 hrdinové · pátá mistrovská řada · 13 druhů vlivů,
elity a pravidla vln · vývojový strom 3 patra × 8 cest s možností přeladit ·
6 režimů · obchod s denní nabídkou · sezónní cesta · trofejní cesta · 25 úspěchů ·
sbírka karet · laboratoř · příslušenství · encyklopedie · zkouška z geodézie
(36 otázek) · zakázka dne · terénní služby · offline provoz
