/**
 * Příručka měřiče: postupy krok za krokem s vysvětlením „proč“. Otevírá se tlačítkem „?“
 * v HUD a v jednotlivých obrazovkách (na odpovídající kapitole).
 */
export interface ManualChapter {
  id: string;
  title: string;
  intro: string;
  steps: { do: string; why?: string }[];
  tips?: string[];
}

export const MANUAL: ManualChapter[] = [
  {
    id: 'start',
    title: 'Jak začít den',
    intro: 'Každá směna začíná v kanceláři: vybereš zakázku, naložíš vybavení a jedeš na místo.',
    steps: [
      { do: 'U vchodu kanceláře otevři nástěnku (dispečink) a převezmi zakázku.', why: 'Zakázka určuje, co měřit, s jakou přesností a jaké vybavení budeš potřebovat.' },
      { do: 'Ve skladu (garáž vedle) vezmi vybavení ze seznamu zakázky. Do každé ruky jednu věc.', why: 'Kufry a stativ jsou těžké – víc věcí najednou neuneseš.' },
      { do: 'Věci ulož do dodávky zadními dveřmi, pak nastup dveřmi řidiče.', why: 'Do kabiny se s plnýma rukama nevejdeš.' },
      { do: 'V tabletu (Mapa) dej Odjet a vyber lokalitu.' },
      { do: 'Na místě vyndej vybavení zadními dveřmi a pusť se do práce.' },
    ],
    tips: ['Řádek „Co dál?“ nahoře vždy radí další krok a šipka ukazuje směr.', 'Pepa (oranžové tlačítko) ti podrží výtyčku nebo lať, přečte přístroj, donese věci z auta i je tam odnese, přiveze dodávku a poradí, co dál a proč.', 'U stanice stačí povel „Postav hranol na … (orientace)“ – Pepa si vezme tvou výtyčku a dojde s ní na orientační bod.'],
  },
  {
    id: 'gnss-rig',
    title: 'GNSS: sestavení roveru',
    intro: 'Rover = karbonová výtyčka + přijímač GNSS nahoře + kontroler v držáku. Sestavuje se u otevřeného kufru.',
    steps: [
      { do: 'Polož kufr GNSS na zem, vezmi výtyčku a zamiř na kufr: Sestavit rover.' },
      {
        do: 'Výška: klepni na žlutou páčku aretace, táhni výtyčku a v lupě odečti výšku u horní hrany svěrky. Páčku zaklapni.',
        why: 'Přijímač měří polohu antény, ne hrotu. Výšku antény nad hrotem musí znát kontroler – jinak budou všechny výšky špatně o rozdíl.',
      },
      { do: 'Vyndej přijímač, nasaď ho na závit 5/8″ a krouživým tahem ho zašroubuj po směru hodinových ručiček.', why: 'Levou rukou (✋ / mezerník) drž výtyčku, jinak se protočí s přijímačem.' },
      { do: 'Nasaď držák, utáhni jeho šroub a zasuň kontroler.' },
      { do: 'Zapni přijímač i kontroler podržením tlačítka napájení přímo na přístroji.', why: 'LED přijímače začne blikat – hledá družice.' },
    ],
    tips: ['Rozebírá se opačně: vypnout, kontroler ven, povolit držák, odšroubovat přijímač, vše do kufru.'],
  },
  {
    id: 'gnss-ctrl',
    title: 'GNSS: nastavení kontroleru',
    intro: 'Kontroler (tlačítko Kontroler / K) je polní software. Bez nastavení přijímač neměří v centimetrech.',
    steps: [
      {
        do: 'Zakázka → název a souřadnicový systém S-JTSK / Krovak (EPSG:5513) + Bpv.',
        why: 'EPSG:5514 dává záporné souřadnice (pro GIS), elipsoidické výšky jsou o ~45 m výš než Bpv, UTM je úplně jiný systém. Kontrola na známém bodě chybu prozradí.',
      },
      { do: 'Import → nahraj bodové pole a data zakázky (vytyčovací výkres, souřadnice hranic).', why: 'Bez nahraných bodů nemáš s čím porovnat ani co vytyčit.' },
      { do: 'Přijímač → Hledat zařízení → připoj GNSS R-7 (spárování Bluetooth).' },
      { do: 'Anténa → typ GNSS R-7 interní a výška, kterou jsi odečetl na výtyčce.' },
      {
        do: 'Korekce → Načíst tabulku zdrojů → VRS3-GG → Připojit.',
        why: 'Bez korekcí RTK ze sítě CZEPOS má přijímač přesnost jen v metrech. VRS (virtuální stanice) je nejpřesnější; jedna vzdálená báze přidá chybu ~1 mm na každý km.',
      },
      { do: 'Počkej na FIX (zelený stav nahoře).', why: 'FLOAT = decimetry, FIX = centimetry. Pod stromy a u zdí FIX nemusí přijít.' },
    ],
  },
  {
    id: 'gnss-measure',
    title: 'GNSS: měření a kontrola',
    intro: 'Každá práce začíná kontrolou na bodu bodového pole – ověříš tím celé nastavení.',
    steps: [
      { do: 'Postav hrot na bod bodového pole (např. 4001), srovnej bublinu a dej Změřit.', why: 'Kontroler ukáže odchylky od katalogu. Pár mm až 2 cm je v pořádku; decimetry a víc = chyba nastavení.' },
      { do: 'U každého bodu vyber kód (Vpust, Roh budovy…) a změř.', why: 'Kód říká kreslíři, co bod znamená. Špatný kód = bod se nezapočítá.' },
      { do: 'Během observace (5 s) stůj a drž bublinu v kroužku.', why: 'Náklon výtyčky posune anténu: bublina na okraji ≈ 1 cm chyby.' },
    ],
    tips: ['Zaměření skutečného provedení sítí (přípojky) se dělá v otevřeném výkopu, hrot na vrch trubky. Po zásypu už to nejde – hlídej čas.', 'Dvojnožka (tlačítko nad libelou) výtyčku opře a drží svisle.', 'Na louce je slabý signál – když vypadnou korekce, počkej, FIX se vrátí.'],
  },
  {
    id: 'stakeout',
    title: 'Vytyčení bodů',
    intro: 'Vytyčit = najít v terénu místo s danými souřadnicemi a označit ho kolíkem.',
    steps: [
      { do: 'V kontroleru nahraj soubor s body zakázky a v Vytyčit vyber bod.' },
      { do: 'Jdi podle šipky; údaj Vpřed / Vpravo říká, kam ještě posunout hrot.', why: 'U bodu se automaticky zpomalíš, ať ho trefíš na centimetry.' },
      { do: 'Opři výtyčku o dvojnožku, počkej na ustálení a dej Zatlouct kolík.', why: 'Mezní odchylka bývá 2–3 cm – kolík mimo znamená opravu.' },
    ],
  },
  {
    id: 'tripod',
    title: 'Totální stanice: stativ a nasazení',
    intro: 'Stanice měří úhly a délky. Stojí na stativu přesně nad bodem.',
    steps: [
      { do: 'Se stativem v ruce zamiř na bod a dej Rozložit. Povol svěrky všech tří nohou (ťuknutím).' },
      { do: 'Táhni dolů – nohy se vysunou. Hlava stativu má být zhruba ve výšce hrudníku (měřítko vpravo ukáže „akorát“). Svěrky zase zajisti.', why: 'Okulár stanice pak máš u oka. Nezajištěná noha by se pod stanicí zasunula.' },
      { do: 'Roztáhni nohy do stran a sešlápni ostruhy všech tří nohou do země.', why: 'Široký a sešlápnutý stativ drží i ve větru; úzký nebo volný vítr převrátí i se stanicí.' },
      { do: 'S kufrem stanice zamiř na stativ: Nasadit stanici. Posaď ji doprostřed hlavy a zespodu přitáhni upínací šroub.', why: 'Stanici drž levou rukou, dokud není přitažená – jinak spadne.' },
      { do: 'Ustavit přístroj: laserovou olovnici dostaň na bod, krabicovou libelu srovnej nohama stativu, elektronickou šrouby trojnožky.', why: 'Nohy stativu posouvají hlavně bublinu, šrouby trojnožky jemně urovnají i laser. Nakonec případně posuň trojnožku po hlavě.' },
    ],
  },
  {
    id: 'ts-measure',
    title: 'Totální stanice: orientace a měření',
    intro: 'Stanice zná jen úhly od sebe. Aby měřila v S-JTSK, musí vědět, kde stojí a kam míří (orientace).',
    steps: [
      { do: 'Po ustavení odečti výšku přístroje na pásmu a zadej ji na displeji stanice (Stanovisko).', why: 'Výška přístroje vstupuje do všech výšek; chyba o 1 cm = všechny body o 1 cm vedle.' },
      { do: 'Orientace: namiř dalekohled zhruba na hranol na druhém známém bodě, dej Cílit (ATR) a Orientovat.', why: 'ATR (automatické cílení) dotočí stanici přesně na střed hranolu. Kontrolní délka ověří, že stojíš na správném bodě.' },
      { do: 'Volné stanovisko: stanici postav kamkoli a změř aspoň dva známé body; v tabletu (Stanice) přijmi výsledek.', why: 'Opravy vYX a σ0 ukazují kvalitu – velká oprava = špatný bod nebo špatné měření.' },
      { do: 'Kde GNSS nedá FIX (pod korunami, u zdí), měř stanicí: stanovisko na volném místě s výhledem, orientace na jiný známý bod – klidně i hraniční znak.', why: 'Záměra stanice potřebuje jen volnou přímku, ne volnou oblohu.' },
      {
        do: 'Kde není bodové pole ani GNSS (les), stabilizuj si pomocné body: mimo stromy s FIXem zamiř roverem na volné místo a dej Stabilizovat. Stanici pak postav na jeden a orientuj na druhý.',
        why: 'Pomocné body nesou chybu GNSS. Čím jsou od sebe dál (a čím delší je orientace oproti záměrám), tím menší chyba se přenese do bodů v lese.',
      },
      {
        do: 'Polygonový pořad: kam ze stanoviska nevidíš, dojdi s výtyčkou s hranolem na místo s výhledem dál a dej Stabilizovat – stanice bod změří a zatlučeš hřeb. Stanici pak přestav na nový bod a orientuj ji zpět na předchozí stanovisko.',
        why: 'Každé přestavení přidá chybu orientace a centrace. Proto záměry mezi body pořadu drž dlouhé a pořad co nejkratší.',
      },
      {
        do: 'Přepínač I+II v dalekohledu: stanice změří v I. poloze, proloží dalekohled, změří v II. poloze a zprůměruje.',
        why: 'Průměr obou poloh vyruší kolimační a indexovou chybu přístroje. Rozdíl poloh (2c) prozradí, že je stanice po pádu rozladěná – pak patří do servisu.',
      },
      { do: 'Pak měř body: na hranol (přesnější, dál) nebo bez hranolu (na zeď, roh).', why: 'Koruna stromu v záměře přeruší paprsek; bez hranolu pak změříš list místo bodu.' },
    ],
  },
  {
    id: 'level',
    title: 'Nivelace',
    intro: 'Geometrická nivelace ze středu: přístroj uprostřed mezi latěmi, čte se zadní a přední lať.',
    steps: [
      { do: 'Lať postav na nivelační značku (nebo ji dej Pepovi).' },
      { do: 'Nivelák postav zhruba doprostřed mezi lať a další bod a přečti zadní záměru.', why: 'Stejně dlouhé záměry vyruší chybu horizontu přístroje.' },
      { do: 'Lať přenes na další bod (přestavový nebo cílový) a přečti přední záměru.' },
      { do: 'Pořad veď tam i zpět a hlídej uzávěr (mezní 20 mm·√L).' },
    ],
  },
  {
    id: 'office',
    title: 'Zpracování v kanceláři',
    intro: 'Změřením práce nekončí. Data se v kanceláři zkontrolují, vyčistí a objednatel dostane správný výstup.',
    steps: [
      { do: 'Po práci v terénu sbal vybavení a jeď do kanceláře. V dispečinku u zakázky dej Zpracovat data a odevzdat.' },
      { do: 'Import: načti zápisník z přístroje.' },
      {
        do: 'Kontrola: podívej se na kontrolní body a vyřaď měření, která jsou jen FLOAT nebo mimo toleranci přesnosti.',
        why: 'Objednatel dostane souřadnice na centimetry; jeden decimetrový bod ve výkresu znamená reklamaci. Když ale vyřadíš jediné měření prvku, prvek bude chybět – pak ho musíš přeměřit.',
      },
      {
        do: 'Geometrický plán: k souřadnicím rohů budovy patří oměrné míry pásmem. S prázdnýma rukama zamiř na roh a přilož pásmo, u sousedního rohu odečti.',
        why: 'Oměrné míry jsou nezávislá kontrola: když nesedí se souřadnicemi (FLOAT, nakloněná výtyčka, špatný roh), katastr plán nepřijme.',
      },
      { do: 'Výstup: vyber, co objednatel čeká – protokol o vytyčení, výkres DXF, nivelační zápisník, nebo záznam o rekognoskaci.' },
      { do: 'Odeslat: přijde kontrolní zaměření, protokol a faktura.' },
    ],
  },
  {
    id: 'career',
    title: 'Kariéra, vybavení a servis',
    intro: 'Za zakázky dostáváš peníze a postupuješ ve stupních; těžší zakázky dostaneš až se zkušenostmi.',
    steps: [
      { do: 'Zakázka odevzdaná bez vady se počítá do postupu (Pomocník → Měřič → Samostatný geodet → ÚOZI).' },
      { do: 'Spěšná zakázka dne má příplatek, když ji odevzdáš ještě týž den.' },
      {
        do: 'Baterie: přijímač vydrží asi 7 h, kontroler 9 h, stanice 5 h provozu (v mrazu o třetinu méně). Při 15 % přístroj varuje; náhradní baterie je v kufru – u kufru (stanice: s kufrem u stativu) dej Vyměnit.',
        why: 'Vybitá baterie jde do kufru a nabíjí se v autonabíječce, když je kufr naložený v dodávce. Přes noc se v kanceláři nabije všechno, co v ní je – vybavení nechané v terénu ne.',
      },
      { do: 'Přístroje se opotřebují a pádem poškodí. Poškozený přístroj měří hůř – oprav ho v servisu v kanceláři.', why: 'Stativ se stanicí ve větru může spadnout, když nemá roztažené a sešlápnuté nohy.' },
    ],
  },
];

export function chapter(id: string): ManualChapter {
  return MANUAL.find((c) => c.id === id) ?? MANUAL[0];
}
