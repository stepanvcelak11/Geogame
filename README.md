# Geodet – terénní simulátor

Mobilní FPV simulátor zeměměřiče. Three.js + Vite + TypeScript, běží v prohlížeči telefonu bez instalace.

## Co hra umí

- **Herní cyklus**: úvodní obrazovka (nová kariéra / pokračovat), ráno v **kanceláři** u nástěnky zakázek (dispečink: odměna, obtížnost, dojezd, zadání, kontrola vybavení), **sklad** s vybavením, nakládání do dodávky zadními dveřmi (nákladový prostor ukáže, co chybí k zakázce), výjezd na stavbu (14 min) nebo louku (26 min), odevzdání s výplatou v Kč (k opravě 30 %), konec směny na nástěnce, postup se ukládá do telefonu.
- **Pomocník Pepa** (vysílačka, oranžové tlačítko vedle Mapy): pojď za mnou / počkej tady, vezmi si výtyčku nebo lať, jdi s ní na bod (ze seznamu známých bodů, prvků a vytyčovaných bodů, nebo tam, kam se díváš) a drž ji svisle, vrať mi ji, stůj u niveláku / totálky a přečti lať nebo změř můj hranol. Obchází překážky, jezdí s tebou v dodávce, na stavbě nosí helmu.
- **Mraky** na obloze plují s větrem.
- **Vizuál**: zapečené stíny pod korunami stromů a u staveb, skutečné stíny i na mobilu, kopce na obzoru ve dvou vrstvách (vzdušná perspektiva), luční kvítí, lesklá hladina rybníka s odleskem slunce, kroužící ptáci, jemný reliéf trávy.
- **Den plyne**: slunce ráno nízko na východě, v poledne na jihu, navečer teplé světlo ze západu, pak soumrak a noc (baterka se hodí). Obloha, mlha a světla se mění plynule.
- **Počasí na každý den** (předpověď na nástěnce a v tabletu): jasno, polojasno, zataženo, déšť, silný vítr, mlha. Vítr rozkývá výtyčku a rozechvěje nivelák, v mlze dálkoměr dosáhne bez hranolu ~60 m a na hranol ~180 m, v dešti bez hranolu ~150 m, za jasného poledne se vzduch tetelí a dlouhé nivelační záměry jsou horší. Vzhled: šedší obloha, tlumené slunce, bližší mlha, kapky deště, víc mraků, šum deště.
- Zakázka **Výška hráze rybníka** (louka): nivelace z NZ Kn-15 ve zdi kůlny na patník VB2 na hrázi, tam a zpět; louka se vlní přes 2,5 m, bez přestavových bodů to nejde.
- **Zvuky okolí**: vítr v poryvech, ptáci na louce a u kanceláře, na stavbě cinkání a pípání couvající techniky, v noci cvrčci.
- **Průvodce „Co dál?“** pod hláškami radí další krok podle situace: nástěnka → sklad → naložit → odjet → konkrétní krok zakázky (stanice, orientace, nivelační pořad…) → odevzdat → konec směny. Klepnutím se sbalí.
- **Zápisník do schránky**: v tabletu (Body) tlačítko „Kopírovat zápisník (CSV)“ – číslo;Y;X;H;kód;metoda;řešení;lokalita.
- **Výtyčka v ruce se kývá**: ruka vytrvale ujíždí jedním směrem (bez korekce opustí bublina kroužek zhruba za 2–3 s), třes ruky, rozhoupání při chůzi, víc ve větru. Bublina se táhne prstem do kroužku (20′), klepnutí na libelu výtyčku zhruba srovná. Výtyčka v ruce se ve 3D viditelně naklání. Náklon posune anténu GNSS i hranol ve 2 m, bublina na okraji ≈ 12 mm chyby.
- **Tablet**: rám zařízení se stavovým řádkem (čas, den, účet, GNSS, rádio, baterie), záložky s ikonami, vrstvy mapy Ortofoto / Vrstevnice / Katastr / Body, budovy, rybník a pole v mapě.
- **Grafika**: procedurální textury (tráva, hlína, asfalt, omítka s okny, tašky, prkna, plech), terén s více vrstvami barev, trsy trávy a klasů kolem hráče, patrové smrky, listnáče s keři, kameny, domy se sedlovou střechou, buňka, bagr, zemina, cihly, sloupy s dráty, rybník s rákosím, balíky slámy, kůlna, kancelář se skladem.

- **Dvě pracoviště**, každé s vlastním S-JTSK: **Stavba RD, Nová Ves** (ulice s vpustmi, trafostanice s nivelační značkou, parcela 1254/3) a **Louka u Kněžívky** (polní cesta, meze se stromořadím, pozemek 812/5, TB na kopci).
- **Zakázky v tabletu**: rekognoskace bodového pole, vytyčení rohů domu (mezní odchylka 2 cm), zaměření vpustí a rohů trafostanice s kódy, vytyčení hranice pozemku 812/5 (3 cm). Po odevzdání přijde kontrolní zaměření se skutečnými odchylkami, výsledek je „Odevzdaná“, nebo „K opravě“.
- **Dojíždění dodávkou**: vybavení naložíš zadními dveřmi, nastoupíš dveřmi řidiče (s prázdnýma rukama), jedeš z pohledu řidiče. Asfalt 50 km/h, polní cesta 32 km/h, tráva 20 km/h. V tabletu pak „Odjet“. Co necháš na zemi, zůstane na původním místě.
- **GNSS RTK rover**: řešení Autonomní → FLOAT → FIX podle zákrytu oblohy (koruny, budovy, terén), měření do zápisníku, kontrola na známých bodech. Při vytyčování naviguje „Vpřed / Vpravo“ jako kontroler, u bodu „Zatlouct kolík“.
- **Ustavení totální stanice**: rozložit stativ nad bodem, nasadit stanici z kufru, pak laserová olovnice, krabicová a elektronická libela, nohy stativu, stavěcí šrouby a posun trojnožky. Fyzika odpovídá realitě: nohy téměř nehýbou laserem, šrouby ano.
- **Měření totální stanicí**: po ustavení „Měřit totální stanicí“ otevře dalekohled s hledáčkem (40°) a zvětšením 30×, nitkovým křížem a jemnými ustanovkami. Režim na hranol (výška 2,000 m) nebo bez hranolu. Nejdřív orientace na hranol postavený na známém bodě s kontrolou délky, pak polární metoda. Přesnost 1″, délky 1 mm + 1,5 ppm na hranol, 2 mm + 2 ppm bez hranolu. Chyba centrace se propíše do výsledku, koruna stromu přeruší paprsek na hranol a bez hranolu vrátí špatnou délku.
- **Robotická stanice ovládaná tabletem na výtyčce** (měření jedním člověkem): „Hledat hranol“ stanici roztočí a zamkne na hranol, ta se pak za ním natáčí. Strom, budova, terén nebo dodávka v záměře zámek přeruší. Orientace se dělá z výtyčky na známém bodě, měření trvá chvilku a během něj se musí stát. Výtyčka držená v ruce přidá chybu ze svislosti (σ 2,5 mm). Vytyčování naviguje ze sledovacího měření stanice. V mapě tabletu je stanovisko a záměra na hranol.
- **Volné stanovisko**: stanici postavíš kamkoli, z výtyčky (nebo dalekohledem na hranol) ji připojíš na 2 a více známých bodů. Tablet v záložce Stanice spočte stanovisko vyrovnáním (shodnostní transformace MNČ, výška z průměru převýšení), ukáže opravy vYX a vH a σ0. Body jde vyřazovat a zařazovat, pak „Přijmout stanovisko“.
- Zakázka **Zaměření trafostanice totální stanicí**: všechny čtyři rohy. JZ, JV a SV ze stanoviska 4001 (orientace na 4021), SZ z volného stanoviska severozápadně od trafostanice.
- **Nivelace**: nivelační přístroj s kompenzátorem a digitální lať 3 m s čárovým kódem. Geometrická nivelace ze středu: lať na bod (i na nivelační značku ve zdi), přístroj mezi body, zadní a přední záměra dalekohledem (záměra je vodorovná, jen se otáčí). Záměry 2–50 m, lať mimo rozsah nebo zakrytá záměra se nepřečte, šum 0,3 mm. Přístroj má chybu horizontu ±8″, takže nevyrovnané záměry zkreslí převýšení a hra na ně upozorní. Nivelační pořad počítá výšky, uzávěr a návaznost.
- Zakázka **Přenesení výšky na stavbu**: z NZ Ab7-12 na nový hřeb VB1 v obrubníku, pořad tam a zpět, mezní uzávěr 20 mm·√L, kontrola výšky VB1 do 3 mm.
- Herní hodiny (start 7:30, 10× zrychleně), jízda mezi lokalitami trvá 22 min.

## Orientace ve hře

- **Řádek „Co dál“** nahoře uprostřed: další krok, šipka směru a vzdálenost k cíli. Nad cílem ve 3D svítí žlutý sloup.
- **Tablet** (tlačítko Tablet vlevo nahoře): záložky Zakázka / Mapa / Stanice / Body přes celou obrazovku. Zakázka je očíslovaný postup se zaškrtáváním; tlačítko „Ukázat cíl na mapě“. Vrstvy mapy pod tlačítkem Vrstvy.
- **Dotykové ovládání**: vpravo dole akční tlačítko, Položit a „⋯“ (Světlo, Přikrčit, Skok). Libela výtyčky vedle akčního tlačítka.

- **Protokol po odevzdání**: hlavička (objednatel, lokalita, den a čas, počasí, metoda, tolerance), tabulka bodů s odchylkami a výsledkem ✓/✗, verdikt a odměna; dá se zkopírovat.
- **Dispečink** ukazuje u každé zakázky postup krok za krokem už před převzetím.

- **Snazší vytyčování**: hrot výtyčky / roveru je vždy 60 cm před hráčem (žádné míření kamerou do země). U cíle se pohyb sám zpomalí až na pár cm/s a bez setrvačnosti – joystickem se dá trefit na centimetry. Navigace průměruje čtení (na dvojnožce déle).
- **Dvojnožka** (tlačítko nad libelou): opře výtyčku, drží ji svisle a hrot stojí, i když se rozhlížíš; pohybem se složí.
- **Vybavení k zakoupení** (dispečink v kanceláři): GNSS s náklonovým senzorem IMU (bublinu u GNSS neřešíš), anténa pro více družicových systémů (FIX i pod řidšími stromy).
- **Profesní stupně**: Pomocník měřiče → Měřič (2 zakázky bez vady) → Samostatný geodet (5) → ÚOZI (9). Stupeň odemyká zakázky vyšší obtížnosti, od Samostatného geodeta příplatek 5 %, ÚOZI 10 %. Postup je vidět nahoře v dispečinku.
- **Spěšná zakázka dne**: jedna ze svěřených zakázek má štítek „Spěchá“ a +30 %, když ji odevzdáš bez vady ještě ten den.
- **Další vybavení**: nivelák s magnetickým tlumením (ve větru poloviční šum čtení) a totální stanice s výkonným dálkoměrem (bez hranolu 2× dál, na hranol v mlze 400 m).
- **Zakázky navíc**: obnova hranice parcely 1254/3 na stavbě (ověřit mezníky 101, 102, 104, vyvrácený 103 vytyčit) a zaměření polní kůlny na louce.
- **Export zápisníku** v tabletu (Body): kopírovat CSV, nebo uložit jako CSV, TXT (seznam souřadnic) či DXF (body s čísly do CADu). Protokol po odevzdání jde uložit do souboru.
- **Offline**: po první návštěvě hra běží i bez signálu (service worker).
- **Bonus za přesnost** v protokolu: +20 % za vytyčení do poloviny tolerance nebo uzávěr nivelace do třetiny meze, +10 % za bezchybné kódy.

## Nastavení

Ozubené kolečko v HUD (nebo „Nastavení grafiky a ovládání“ na úvodní obrazovce): stíny, hustota trávy a kvítí, dohled, úsporné rozlišení, citlivost rozhlížení, obrácená osa Y, hlasitost, zvuky okolí, průvodce „Co dál?“, ukazatel FPS, smazání uložené kariéry. Ukládá se do telefonu.

## Ovládání

**Telefon (na šířku):** levý palec chůze nebo v autě plyn, brzda a volant. Pravá polovina rozhlížení. Žluté tlačítko je akce podle situace. Sloty rukou vybírají aktivní ruku, „Položit“ položí předmět, „Mapa“ otevře tablet.

**Klávesnice:** WASD pohyb / jízda, myš rozhlížení, E akce (v autě vystoupit), Q přepnout ruku, G položit, M tablet, F baterka, C přikrčit, mezerník skok.

## Vývoj

```
npm install
npm run dev        # Vite dev server (otevři z telefonu přes IP v síti)
npm run build      # produkční build do dist/
npx tsx tests/run.ts   # logické testy (souřadnice, terén, kolize, GNSS, ustavení, dodávka, zakázky)
```

## Nasazení

Push do `main` spustí workflow `.github/workflows/pages.yml`: testy, build a nasazení `dist/` na GitHub Pages. V repozitáři je potřeba jednou nastavit **Settings → Pages → Source: GitHub Actions**.

Architektura: logika (`core`, `world`, `geodesy`, `player`, `interaction`, `items`, `jobs`, `gnss`, `survey`, `vehicle`) nezná three.js ani DOM a testuje se v Node. `render/` je jen three.js, `ui/`, `input/`, `audio/` jen DOM. `Game.ts` vše propojuje. Rendering běží v lokálním rámci u počátku, S-JTSK (float64) jen v logice.

## Další kroky

- Zakázka na louce pro totální stanici (stromořadí na mezi, kde GNSS nedá FIX).
- Zakázky s náhodnými variantami (jiné body, jiný objednatel), aby se daly hrát opakovaně.
