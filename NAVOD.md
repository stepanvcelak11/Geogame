# GeoGame — verze 93

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

Číslo verze se od verze 82 píše na **jediné místo** — `const VERZE=93;` v `index.html`.
Odtud se rozsype do stránky i do adresy, kterou se registruje `sw.js`. Jinam se nesahá.

## Bez hostingu

`geogame-v93-jediny-soubor.html` stáhni do telefonu a otevři v Chromu.
Funguje offline, jen se sám neaktualizuje.

Od verze 82 je tenhle soubor **přesná kopie `index.html`**. Hra si sama pozná, že běží
ze staženého souboru, a manifest si přepíše. Novou verzi tedy vyrobíš prostým zkopírováním
a není co udržovat dvakrát:

```
copy index.html geogame-v93-jediny-soubor.html
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

## Co je nového ve verzi 92

### Hrdinové

**Hrdina konečně stojí za svá čtyři pole.** Zabírá čtyři stanoviště u trasy,
ale odváděl práci jednoho. Změřeno na odehraných bězích (odvedené poškození
hrdiny proti průměru běžného stanoviska, 12 území × 3 kola): dron zastal
**1,3** stanoviska, rotační laser **2,5**, mensula **0,7** — a běh s hrdinou
vycházel stejně jako běh bez něj, takže to bylo jen hezčí místo na desce.
Teď zastane dron **3,8**, rotační laser **3,6** a mensula **2,8**;
mensula k tomu přisype ještě kolem **2 100** rozpočtu za běh a sama posune
výsledek z 8,7 na 10,3 vyhraných území z dvanácti.

⚠ Síla se ladí na jednom místě — konstanta `HRD_SILA` v `index.html`. Kdo ji
bude přelaďovat: **„škoda na 1 rozpočtu" měřená na zmrazených cílech tuhle
otázku nezodpoví** (nadhodnocuje všechno, co bije po ploše, a dron s pěti
stroji je z toho nejcitlivější). Platí jedině odehraný běh, a měřidlo je
vratké — tři kola a medián, ne jedno kolo.

⚠ Mensula nemá málo poškození, má málo **příležitostí**: je to jednocílový
přístroj s kadencí kolem 1/s, takže od jisté hranice už jen přestřeluje.
Při násobku 3,4 i 6,2 se zastavila na 2,2 stanoviska. Pohnul s ní až násobek
**kadence** — ten zároveň zvyšuje její přísun do rozpočtu, tedy přesně to,
čím má být.

**Hrdinu jde rozkliknout.** Ve výběru hrdiny přibylo tlačítko **Detail**.
Do teď šlo hrdinu jen vybrat: běžné přístroje mají v nabídce sestavy `?`,
hrdinové neměli nic — a okno detailu u nich navíc lhalo, ukazovalo „cena"
a „karet", ačkoli hrdina se nekupuje ze skladu ani nesbírá karty. Teď je
u každé řady vidět cena vylepšení a schopnost, která v ní přibude.

**Kalibrace hrdiny zdražila** z 662 na 1 648 až 1 918 za plnou. Stála tolik
co u pásma, ačkoli těch +18 % počítá z několikanásobně většího čísla — u hrdiny
to tedy bylo několikanásobně víc síly za tutéž cenu. Cena teď vychází z toho,
co už do něj hráč nalil (sečtené ceny řad), ne z paušálu.

**Uzávěr etapy.** Každá etapa teď končí číslem: jak daleko po trase se dostal
nejhlubší vliv. Dokud jsi neztrácel přesnost, hra mlčela — a tys nevěděl, jestli
to bylo o vlas, nebo o tři třídy. Změřeno robotem: **86 % etap skončilo beze změny
jediné číslice.** Uzávěr to řekne dopředu (v prohraném území roste z 39 % na 100 %
už čtyři etapy před první ztrátou) a čím dál od nulového bodu obranu udržíš, tím
větší dotace.

**Mistrovská řada ★ až ★★★.** Čtvrtá řada bývala strop, na který se dosáhne kolem
desáté etapy — a tím růst skončil, zatímco vlny rostly dál. „Mistrovská varianta"
sice existovala, ale byla to jediná hvězda a bylo na ni potřeba **osm** přístrojů
téhož druhu; robot na ni za celý běh došel třikrát ze sedmdesáti etap. Teď nad
čtvrtou řadou vede žebřík tří hvězd, každá **+90 % poškození**, a vedou k ní dvě
cesty: sloučit dva stejně označené přístroje (zdarma), nebo hvězdu koupit
(260 / 900 / 1 900). Tlačítko je tam, kde bývalo SLOUČIT, jakmile není s čím slučovat.

**Koupená hvězda přežije POKRAČOVAT.** `plus` se neukládalo do snímku rozehrané
hry už od doby, kdy vzniklo — po načtení se mistrovská řada tiše ztratila i s tím,
co za ni hráč zaplatil. Změřeno: ★★ za 1 160 rozpočtu → po načtení **267 poškození
místo 746**.

**Kapacita čety konečně něco znamená.** Rostla na 43–46 stanovisek, zatímco na
desce jich stálo 8–14 — to číslo v HUDu za celý běh nikdy nic neomezilo. Hlavní
příčina: +1 za každé třetí sloučení bez stropu, ačkoli sloučení už samo jedno
místo uvolňuje. Teď má strop. Podíl etap, kdy je četa plná, u hráče, který
neslučuje: **33 % → 51 %**; u toho, kdo slučuje, zůstává skoro nulový. Slučování
je tím konečně to, čím má být — cesta ven z nedostatku místa.

**Příjem drží krok s vlnami.** Dotace přestávala růst ve 12. etapě a odměna za
zničený vliv nerostla vůbec, ale odolnost vln mezi 12. a 24. etapou vyroste 22×.
Nebyl to strop síly, ale peněz.

**Gravimetr konečně ubírá.** Celé jeho poškození jde přes vír a ten je uděloval
po snímcích — zlomek bodu, ze kterého pancíř sebral všechno. Sedání bodu,
Multipath, Rušička ani boss od něj nedostávali **nic**, a přitom je držel na
místě, takže etapa neměla jak skončit.

**Pásmo mělo zdarma průbojnost**, kterou popisek slibuje jen teodolitu. Teodolit
za dvojnásobek ceny byl proto horší nákup skoro ve všem.

**Tlak je rovnoměrnější.** První třetina území už není na všech dvanácti stejná
a poslední třetina už není zeď.

## Co je nového ve verzi 91

Verze podle připomínek hráče. Prošel novou podobu hry obrazovku po obrazovce —
všech 49, od menu přes všech šestnáct oken po záložky panelu v měření — a
u 48 z nich napsal, co s nimi. Tohle je zapracování jeho slov.

Nejčastější věta byla „text malý a nepřehledný" a „je toho tam moc namačkaného".
Změřeno na 15 obrazovkách ve třech motivech: z 3 242 popisků jich bylo
**1 883 (58 %) pod 12 px**. Po opravě ani jeden. Stupnice odsazení šla o 15–20 %
nahoru, výška řádku popisů na 1,55. Hrací deska se tím zmenšit nesměla, takže
herní obrazovka má vlastní hustotu: políčko má na 390×844 pořád 42 px.

**Terén**
- **Mapa světa se roluje na výšku** a jsou v ní vidět **tři území naráz**;
  celá trasa se otevře po klepnutí. Platno vyrostlo z 384×361 na 384×1362 px,
  krok mezi územími je 112 px a cedulky se už nepřekrývají (kresleno je jich
  dvanáct místo sedmi). Nadpis „Mapa světa" stojí nad mapou, ne na ní.
- Ikona Terénu ve spodní liště je vycentrovaná (odchylka 0,02 px), text HRÁT
  je méně tučný, profil geodeta má čitelnou hodnost a postup.
- Režimy jsou menší a mají „i" s vysvětlením. Karta **„Co teď" je pryč**.

**Obchod**
- **Měny se po klepnutí vysvětlí** — u mezníků včetně toho, kde se berou.
  Patní poznámka „Kde se mezníky berou" tím zmizela z výpisu.
- Ikony vzhledů jsou světlejší (průměrný jas dlaždic 106–158 → 132–195).
- **Živý náhled, jak přístroj vypadá na desce**, s trasou a zásahy.
- Přibyla police **legendárních vzhledů** se zvláštním efektem při měření —
  pečeť, vlna nebo roj. Mění jen vzhled, ne sílu.

**Vybavení a Laborka**
- Sestava, hrdinové, měřické metody a karty leží ve **třech zapuštěných deskách**,
  ne v jednom svitku; odznak úrovně je čitelný (kontrast 8,91 → 11,56:1).
- Text „Jak se sestava skládá" je pryč.
- **Vylepšení mají jemnější kroky a každý přístroj jich má stejný počet.**
  Robot dohrál stejně jako předtím (8/12 s běžným postupem, 10/12 s plně
  vylepšeným) — obtížnost se neposunula.

**Kariéra**
- **Trofejní i sezónní cesta jsou svislý pás**, ne poloviční výřez posouvaný
  do strany: vodorovné rolování 1 420 px → 0, písmo 10,5–11,5 px → 12–15 px,
  20 prvků mimo okno → 0.
- **Odměna se při vyzvednutí odhalí i s kartami**, jako u bedny; totéž
  u denní odměny.

**Encyklopedie**
- Všech osm záložek: 0 popisků pod 12 px, nejnižší kontrast 4,62 → nad 6:1.
- Vzácnost je vidět barvou (proužek, lem i pilulka).
- Srovnání má **sloupce místo holých čísel**.

**Měření**
- Tlačítka jsou světlejší (jas plochy 0,037 → 0,074), lišta nahoře je nižší
  (88 → 73 px), z karet přístrojů zmizely úrovně a z desky cedulka „ODSUD".
- **Rada dole mlčí, jakmile máš první území dohrané**, a jde zavřít křížkem.
- Křížky a záložky panelu mají dotykový terč 44 px.

**Okna**
- Detail území je bez doporučené sestavy a s **náhledem mapy 150×193 px**
  místo 62×80.
- Detail přístroje je rozdělený do tří záložek (jeden svitek 1 528 px →
  867/735/851 px).

### Co zůstává na příště

- **Srovnání v encyklopedii je teď 3,3× delší** (1 167 → 3 875 px): je čitelné,
  ale všech 23 přístrojů už nejde přehlédnout naráz.
- V záložce **Podmínky** se věta „potlačí meteostanice" opakuje devětkrát.
- Prázdné hledání v encyklopedii nechá zapnuté „vše" — stará vada z verze 89.
- Kód zálohy postupu ztratil neproporcionální písmo.
- Na 320 px se v okně celé trofejní cesty pár popisků láme na dva řádky.

## Co je nového ve verzi 90

Opravné vydání, **dvaadvacet oprav**. Nic nového se nepřidávalo, jen se spravilo,
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

- **Příslušenství slibovalo skoro dvojnásobek toho, co dává.** Všech dvanáct
  kusů mělo v popisku číslo z doby před vyvážením — skutečná hodnota je přesně
  **0,55násobek**. Změřeno na živých přístrojích: Přesná libela slibovala +8 %
  poškození a dávala **+4,4 %**, Naklápěcí senzor +15 % dosahu aury a dával
  **+8,3 %**, Termokamera +10 % a dávala **+5,5 %**, Vyšší frekvence +12 %
  a dávala **+6,6 %**. Popisky teď říkají, co hra opravdu dělá, a všude dodávají
  **za úroveň** — dosud to stálo jen u jednoho z dvanácti, takže se dalo číst
  jako celkový účinek. Hodnoty samotné se nezměnily; jestli mají být silnější,
  je to rozhodnutí o vyvážení, ne oprava.
- **Hranol 360° měl první úroveň za 99 výzkumu, která nedělala vůbec nic.**
  Řetěz dálkoměru se počítá cyklem, takže zlomek pod jedničkou se ztratí:
  změřeno **3 zásahy před i po** první úrovni, čtvrtý přibyl až u druhé.
  Nově je úroveň jediná, za tutéž celkovou cenu (279) a se stejným výsledkem —
  jen z obchodu zmizela slepá položka, na kterou se dal vyhodit výzkum.
- **Popisky synergií dvojic** slibovaly víc, než dávají — osm z deseti, opět
  0,55násobek (Fúze dat slibovala +30 % poškození dronů, dává +16,5 %;
  Klasické mapování +35 % rychlosti, dává +19,3 %). Sjednoceno s kódem.
- **Rozpočet na konci etapy mohl být zlomkový.** Radiomodem přidává 2,2 za
  stanici, takže hra hlásila „Etapa 3 hotova · **+18.2 rozpočtu**" a rozpočet
  nebyl celé číslo. Zaokrouhlí se, až když je celý bonus spočítaný.
- **Karta Předsunuté stanoviště nedělala to, co slibovala.** Text říká „hned
  uvolní dvě místa u trasy", ale jediné, co dělala, bylo **+2 ke kapacitě** —
  tedy přesně totéž co běžná karta Terénní četa, jen za vzácnost. Změřeno:
  odkrytých políček 62 → 62, kapacita 6 → 8. Teď opravdu odkryje dvě políčka
  (62 → 64) a kapacitu nechává být.
- Karta **Výkonné baterie** slibovala dronům +25 % doletu i rychlosti; rychlost
  dostává 15 %. Popisek to teď říká.

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

**Otevřená otázka k vyvážení, ne vada:** příslušenství i synergie dávají 0,55×
toho, co původně slibovaly. Opravily se texty, ne hodnoty — kdyby měly být
hodnoty zpátky na původní výši, je to zásah do vyvážení a patří k rozhodnutí,
ne k úklidu. Stejně tak karta Rozhledny dá auře GNSS 12 %, zatímco dosahu všech
ostatních přístrojů 7 %; hráč tam dostává víc, než mu hra slíbila, takže se to
nechalo být a v kódu je u toho poznámka.

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

## Co je nového ve verzi 93

Verze o **obsahu**: čím se dvanáct území liší jedno od druhého. Verze 92 srovnala,
jak se hraje; tahle řeší, **co se hraje**. Do minulé verze byla mezi územími
rozdílná jen trasa, terén a počet etap — chodily po nich tytéž vlivy ve stejném
pořadí a **finálový boss se lišil jen jménem**.

**Dvanáct finálových bossů se konečně chová podle svého popisu**

V mapě u každého území stála věta o tom, co jeho boss umí: „odolá i pancéřovým
metodám", „léčí okolní vlivy", „postupně zrychluje", „ruší stanoviska", „silný
pancíř", „odolá zpomalení". Ani jedna z nich nebyla pravda — všech dvanáct bossů
mělo tytéž hodnoty a tytéž čtyři náhodné akce. Teď má každý svůj rys:

| Území | Finále | Co doopravdy dělá |
|---|---|---|
| Katastrální území | Neuzavřený polygon | pancíř mu **nejde snížit** — průrazné metody, fólie ani karty na něj neplatí |
| Údolní přehrada | Sesuv hrázního tělesa | **vrací odolnost** vlivům kolem sebe |
| Rašeliniště | Bezedná sonda | **nabírá tempo** — každou vteřinu o 4 % rychleji, až do dvojnásobku |
| Lomová stěna | Odlomený blok | stanoviska do 2,5 pole od něj **každou čtvrtou ranou minou** |
| Městská zástavba | Chyba orientace | každých 8 s **umlčí stanoviska** kolem sebe na 2,5 s |
| Důlní dílo | Zával chodby | o **8 vyšší pancíř** než ostatní bossové |
| Letecká plocha | Turbulentní vzduch | o 35 % **rychlejší**, zato křehčí |
| Železniční koridor | Posun násypu | léčí okolí **a zároveň** nabírá tempo |
| Zátopová oblast | Povodňová vlna | každých 7 s **vypustí pět šumů** a kryje okolí o 25 % |
| Rozcestí sítí | Rozpojená síť | vyrazí **na každou z obou tras jeden**, každý slabší |
| Mostní konstrukce | Dilatace mostu | **zpomalení na něj působí jen z třetiny** |
| Vysokohorská síť | Lavina | nabírá tempo, uvolňuje roj a vzdoruje zpomalení |

**Rys není síla zadarmo.** Každý má cenu, o kterou boss přijde na odolnosti —
jinak by finále každého území tiše ztěžklo. Turbulentní vzduch je proto o 35 %
rychlejší, ale o čtvrtinu křehčí, a dvojice na Rozcestí sítí má každý o 38 % nižší
odolnost, přesně tím koeficientem, kterým se na území se dvěma trasami škáluje
všechno ostatní.

Rysy nestojí v textu dvakrát: popisek v encyklopedii, řádek v detailu území
i hlášení na začátku finále se skládají z **téže tabulky**, kterou se řídí kód.
Text a chování se tím nemají jak rozejít — přesně to se stalo předtím.
Po klepnutí na bosse navíc kartička ukáže jeho jméno, **skutečný pancíř**
(u Závalu chodby 17, ne 9) a čím se liší.

Na Rozcestí sítí to opravuje starou vadu: území se dvěma trasami posílá menší
vlny a **dvojice finálových bossů se tím zaokrouhlila na jednoho**, takže jedna
z obou tras zůstala bez bosse a slib „chodí po obou trasách" byl nepravdivý.
Boss se nově nedělí.

**Každé území posílá svou vlastní směs vlivů**

Dosud chodilo na všech dvanácti územích totéž. Nově má každé své složení podle
prostředí: ve **městě** je skoro dvakrát tolik multipathu a víc rušiček, v **dole**
rušičky a zákryty, na **letišti** refrakce a šum, na **rašeliništi** sedání bodu,
na **mostě** drift a zákryt, ve **vysokohorské síti** zákryt a refrakce.

Obtížnost se tím posunout nesměla. Drží se proto **váha vlny** — jenže ne pouhý
součet odolnosti. Rušička umlčí stanoviska kolem sebe, léčitel drží celou vlnu
a zákryt sráží poškození všem sousedům: **vyměnit je za stejné množství odolnosti
v šumu není výměna jedna ku jedné.** Každý druh vlivu má proto ještě násobek síly
(rušička 2,2×, léčitel 2,5×, zákryt 2,0×) a území za ně v rozpočtu vlny platí víc.
Jak vyhraněná území jsou, drží jediné číslo `MIX_SILA` — kdyby měl někdo chuť
rozdíly zvětšit nebo zmírnit, mění se jedna konstanta, ne dvanáct tabulek.

Měřeno robotem, tři kola proti třem: **9,7 výhry z 12 u verze 92 i u téhle**
(jednotlivá kola 11/9/9 proti 10/9/10 — takový je rozptyl samotného měřidla).
Mění se, **co** chodí, ne kolik toho je.

Nebyl to první pokus. Napoprvé vyšlo **8,0 proti 9,7** a bylo to na rysech, které
byly čistý přídavek. Napodruhé, už s jejich cenou, **8,7** — a rozklad ukázal, že
zbytek nedělaly rysy (9,7), ale právě ta směs (8,7), protože se vážila jen
odolností. Až třetí pokus, s násobkem síly, drží obojí.

V detailu území proto nově stojí řádek **Nejčastější vlivy** — a jde se podle něj
vybrat sestava. Čte se z téhož předpisu, kterým se vlna doopravdy skládá.

**Všech dvanáct rušivých vlivů má výklad**

Přístroje měly v encyklopedii odborný výklad od začátku, vlivy jen jednu větu
o tom, jak se chovají ve hře. Teď má každý z nich vysvětlení, co to v geodézii
doopravdy je, a k tomu jednu věc z praxe — multipath a odrazy od fasád, refrakce
a její poměr k zakřivení Země, rozdíl mezi chybou náhodnou, hrubou a systematickou,
vyrovnání, které chybu „rozpustí" do sítě, i to, proč se rušička do zapalovače
pozná podle skokového pádu počtu družic.

**Zkouška má místo 36 otázek 60**

Denně se losuje pět, takže se při 36 otázkách začaly opakovat do týdne. Nových
čtyřiadvacet je na multipath, počet družic, fixované řešení RTK, nadbytečná měření,
uzávěr pořadu, ETRS89 a transformaci do S-JTSK, excentricitu stanoviska, žabku
a invarovou lať, výšku antény, kolmici pentagonem, rajón, VFK, měřítko sáhových
map, PPBP, georadar, InSAR, zenitový úhel, sklon v procentech, kubatury z profilů
a ověření úředně oprávněným zeměměřickým inženýrem.

**Encyklopedie ví o hře konečně všechno**

Dala se v ní dohledat každá z 23 pomůcek, ale **ani jedna ze 36 karet** — přitom
karta je to, co si hráč vybírá po každé etapě. Stejně tak v ní nebyly měřické
metody, vylepšení sítě ani příslušenství z laborky. Přibyla proto záložka
**Karty a metody**: všech 36 karet po vzácnostech s tím, kolikrát jde tatáž vzít
a od které etapy se nabízí, všech 7 metod i s dobíjením, 5 vylepšení sítě
a 12 kusů příslušenství s cenou prvního stupně. Hledání je teď najde taky —
napiš „Rozhledny" a karta vyskočí.

Záložka **Terén se rozrostla na Území**: všech dvanáct v pořadí, jak jdou po sobě,
se zadáním, počtem etap, odemykaným přístrojem, zákazy, nejčastějšími vlivy
a finálovým bossem i s jeho rysem. Terén zůstal pod tím.

**Podmínky etapy** dostaly stejné zacházení jako vlivy: ke každé z osmi je výklad,
co to v geodézii doopravdy je — od tetelení nad rozpálenou vozovkou přes výtyčku
ve větru (náklon jednoho stupně na dvou metrech je bod vedle o 3,5 cm) až po mráz,
který vytlačuje kolíky. Věta „potlačí meteostanice" u nich navíc stála
**devětkrát pod sebou**; teď je jednou, zato s číslem: ve čtvrté řadě až z 85 %.

**Tipů z praxe je 40 místo 25** a **úspěchy dostaly dva chybějící vrcholy** —
řada končila na osmi dokončených územích a dvaceti hvězdách, přestože území je
dvanáct a hvězd 36.

### Čeho se tahle verze nedotýká

Vzhledu ani čísel balancu. Křivka odolnosti vln, kapacita čety, mistrovská řada
i ceny jsou přesně takové, jaké je nechala verze 92.

## Co je nového ve verzi 92

**Uzávěr etapy.** Každá etapa teď končí číslem: jak daleko po trase se dostal
nejhlubší vliv. Dokud jsi neztrácel přesnost, hra mlčela — a tys nevěděl, jestli
to bylo o vlas, nebo o tři třídy. Změřeno robotem: **86 % etap skončilo beze změny
jediné číslice.** Uzávěr to řekne dopředu (v prohraném území roste z 39 % na 100 %
už čtyři etapy před první ztrátou) a čím dál od nulového bodu obranu udržíš, tím
větší dotace.

**Mistrovská řada ★ až ★★★.** Čtvrtá řada bývala strop, na který se dosáhne kolem
desáté etapy — a tím růst skončil, zatímco vlny rostly dál. „Mistrovská varianta"
sice existovala, ale byla to jediná hvězda a bylo na ni potřeba **osm** přístrojů
téhož druhu; robot na ni za celý běh došel třikrát ze sedmdesáti etap. Teď nad
čtvrtou řadou vede žebřík tří hvězd, každá **+90 % poškození**, a vedou k ní dvě
cesty: sloučit dva stejně označené přístroje (zdarma), nebo hvězdu koupit
(260 / 900 / 1 900). Tlačítko je tam, kde bývalo SLOUČIT, jakmile není s čím slučovat.

**Koupená hvězda přežije POKRAČOVAT.** `plus` se neukládalo do snímku rozehrané
hry už od doby, kdy vzniklo — po načtení se mistrovská řada tiše ztratila i s tím,
co za ni hráč zaplatil. Změřeno: ★★ za 1 160 rozpočtu → po načtení **267 poškození
místo 746**.

**Kapacita čety konečně něco znamená.** Rostla na 43–46 stanovisek, zatímco na
desce jich stálo 8–14 — to číslo v HUDu za celý běh nikdy nic neomezilo. Hlavní
příčina: +1 za každé třetí sloučení bez stropu, ačkoli sloučení už samo jedno
místo uvolňuje. Teď má strop. Podíl etap, kdy je četa plná, u hráče, který
neslučuje: **33 % → 51 %**; u toho, kdo slučuje, zůstává skoro nulový. Slučování
je tím konečně to, čím má být — cesta ven z nedostatku místa.

**Příjem drží krok s vlnami.** Dotace přestávala růst ve 12. etapě a odměna za
zničený vliv nerostla vůbec, ale odolnost vln mezi 12. a 24. etapou vyroste 22×.
Nebyl to strop síly, ale peněz.

**Gravimetr konečně ubírá.** Celé jeho poškození jde přes vír a ten je uděloval
po snímcích — zlomek bodu, ze kterého pancíř sebral všechno. Sedání bodu,
Multipath, Rušička ani boss od něj nedostávali **nic**, a přitom je držel na
místě, takže etapa neměla jak skončit.

**Pásmo mělo zdarma průbojnost**, kterou popisek slibuje jen teodolitu. Teodolit
za dvojnásobek ceny byl proto horší nákup skoro ve všem.

**Tlak je rovnoměrnější.** První třetina území už není na všech dvanácti stejná
a poslední třetina už není zeď.

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

12 území s vlastními bossy · 20 přístrojů + 3 hrdinové · čtyři řady a nad nimi
mistrovská řada ★ až ★★★ · 13 druhů vlivů,
elity a pravidla vln · vývojový strom 3 patra × 8 cest s možností přeladit ·
6 režimů · obchod s denní nabídkou · sezónní cesta · trofejní cesta · 25 úspěchů ·
sbírka karet · laboratoř · příslušenství · encyklopedie · zkouška z geodézie
(36 otázek) · zakázka dne · terénní služby · offline provoz
