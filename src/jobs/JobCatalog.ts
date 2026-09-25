import type { FeatureCode } from '../geodesy/types';
import type { ItemKind } from '../items/items';
import type { LocationId } from '../world/World';

export type JobType = 'rekognoskace' | 'vytyceni' | 'polohopis' | 'nivelace';

export interface JobSpec {
  id: string;
  title: string;
  client: string;
  location: LocationId;
  type: JobType;
  brief: string;
  tolerance: { xy: number }; // [m]
  reconMarks?: string[]; // rekognoskace: ID bodů z katalogu
  stake?: 'dum' | 'hranice' | 'parcela'; // vytyčení: zdroj projektových souřadnic
  featureCodes?: FeatureCode[]; // polohopis: co zaměřit
  featureIds?: string[]; // polohopis: konkrétní prvky (má přednost před kódy)
  requireStation?: boolean; // měřit jen totální stanicí
  stationAt?: string; // doporučené stanovisko (ID bodu)
  orientOn?: string; // orientační bod (ID bodu)
  stationTask?: string;
  /** Kolik pomocných bodů si má měřič stabilizovat GNSS (čísla 8001, 8002…) a doporučená místa. */
  helperPoints?: { x: number; z: number }[];
  /** Polygonový pořad: body stabilizované stanicí (8101, 8102…) a doporučená místa; poslední je konečné stanovisko. */
  traverse?: { x: number; z: number }[];
  /** Za kolik herních minut od převzetí bagr výkop zasype. */
  deadlineMin?: number;
  /** Oměrné míry pásmem: dvojice prvků (sousední rohy budovy). */
  tape?: [string, string][];
  /** Výstup pro objednatele, když se liší od výchozího pro typ zakázky. */
  output?: string; // popis měření stanicí pro kroky zakázky
  levelFrom?: string; // nivelace: výchozí značka (ID)
  levelTo?: string; // nivelace: určovaný bod (ID prvku)
  pay: number; // odměna [Kč]
  kit: ItemKind[]; // potřebné vybavení
  difficulty: 1 | 2 | 3;
  house?: { halfU: number; halfV: number; du: number; dv: number }; // vytyčení domu: rozměr a posun na parcele
  issued?: number; // generovaná objednávka: den vydání
}

export const JOB_TYPE_NAME: Record<JobType, string> = {
  rekognoskace: 'Rekognoskace',
  vytyceni: 'Vytyčení',
  polohopis: 'Zaměření polohopisu',
  nivelace: 'Nivelace',
};

export const JOBS: JobSpec[] = [
  {
    id: 'stavba-rek',
    title: 'Rekognoskace bodového pole',
    client: 'Stavební firma Vltava',
    location: 'stavba',
    type: 'rekognoskace',
    brief: 'Před měřením ověř, které body z katalogu jsou na místě a v pořádku. Chybějící bod nahlas až na místě podle mapy.',
    tolerance: { xy: 0.03 },
    reconMarks: ['PBPP-4001', 'PBPP-4002', 'ZhB-4021', 'TB-0321-014', 'NZ-Ab7-12'],
    pay: 3200,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 1,
  },
  {
    id: 'stavba-rd',
    title: 'Vytyčení rohů rodinného domu',
    client: 'Ing. Novák, stavebník',
    location: 'stavba',
    type: 'vytyceni',
    brief: 'Vytyč čtyři hlavní rohy domu podle projektu. Na každý roh zatluč kolík, mezní odchylka 2 cm.',
    tolerance: { xy: 0.02 },
    stake: 'dum',
    pay: 5800,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 2,
  },
  {
    id: 'stavba-polohopis',
    title: 'Zaměření vpustí a trafostanice',
    client: 'Vodovody a kanalizace',
    location: 'stavba',
    type: 'polohopis',
    brief: 'Zaměř středy všech uličních vpustí a rohy trafostanice. Před měřením vyber správný kód bodu.',
    tolerance: { xy: 0.1 },
    featureCodes: ['VPUST', 'ROH_BUDOVY'],
    pay: 4200,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 1,
  },
  {
    id: 'stavba-ts-zaskoleni',
    title: 'Zaškolení: první měření totální stanicí',
    client: 'Geoměření s.r.o. (interní)',
    location: 'stavba',
    type: 'polohopis',
    brief:
      'Šéf chce, abys uměl i se stanicí. Postup: 1) rozlož stativ nad 4001, sešlápni nohy, nasaď stanici a ustav ji (olovnice, libely); 2) v programu stanice založ zakázku, importuj bodové pole, nastav hranol GPR1, výšku cíle 2,000 m a teplotu s tlakem; 3) odečti výšku přístroje a zadej ji; 4) orientuj na 4021 – Pepa ti tam hranol postaví (vysílačka: Postav hranol na 4021); 5) s výtyčkou s hranolem zaměř dva rohy trafostanice (JV a SV) s kódem Roh budovy.',
    tolerance: { xy: 0.08 },
    featureIds: ['roh-JV', 'roh-SV'],
    requireStation: true,
    stationAt: 'PBPP-4001',
    orientOn: 'ZhB-4021',
    stationTask: 'Zaměř rohy trafostanice JV a SV (hranol na roh, kód Roh budovy)',
    pay: 3600,
    kit: ['tripod', 'tsCase', 'prismPole'],
    difficulty: 1,
  },
  {
    id: 'stavba-tachymetrie',
    title: 'Zaměření trafostanice totální stanicí',
    client: 'Energetika Polabí',
    location: 'stavba',
    type: 'polohopis',
    brief:
      'U zdi GNSS nedá fix. Zaměř všechny čtyři rohy. Ze stanoviska 4001 (orientace na 4021) vidíš JZ, JV a SV. Na SZ roh postav volné stanovisko severozápadně od trafostanice a připoj ho aspoň na dva známé body.',
    tolerance: { xy: 0.1 },
    featureIds: ['roh-JZ', 'roh-JV', 'roh-SV', 'roh-SZ'],
    requireStation: true,
    stationAt: 'PBPP-4001',
    orientOn: 'ZhB-4021',
    stationTask: 'Změř rohy trafostanice, SZ z volného stanoviska',
    pay: 6900,
    kit: ['tripod', 'tsCase', 'prismPole'],
    difficulty: 3,
  },
  {
    id: 'stavba-hranice',
    title: 'Obnova hranice parcely 1254/3',
    client: 'Ing. Novák, stavebník',
    location: 'stavba',
    type: 'vytyceni',
    brief:
      'Před stavbou plotu obnov hranici parcely. Plastové mezníky 101, 102 a 104 ověř měřením. Mezník 103 technika vyvrátila, jeho lom vytyč znovu kolíkem. Mezní odchylka 3 cm.',
    tolerance: { xy: 0.03 },
    stake: 'parcela',
    pay: 6200,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 2,
  },
  {
    id: 'stavba-nivelace',
    title: 'Přenesení výšky na stavbu',
    client: 'Stavební firma Vltava',
    location: 'stavba',
    type: 'nivelace',
    brief:
      'Z nivelační značky Ab7-12 ve zdi trafostanice přenes výšku na nový hřeb VB1 v obrubníku u vjezdu. Pořad veď tam a zpět, záměry drž stejně dlouhé, nejvýš 50 m. Mezní uzávěr 20 mm·√L.',
    tolerance: { xy: 0.003 },
    levelFrom: 'NZ-Ab7-12',
    levelTo: 'vb1',
    pay: 4800,
    kit: ['level', 'rod'],
    difficulty: 2,
  },
  {
    id: 'louka-nivelace',
    title: 'Výška hráze rybníka',
    client: 'Rybářský spolek Kněžívka',
    location: 'louka',
    type: 'nivelace',
    brief:
      'Spolek chce znát výšku hráze. Z nivelační značky Kn-15 ve zdi kůlny u cesty přenes výšku na patník VB2 na hrázi rybníka, tam a zpět. Louka se vlní přes 2,5 m, počítej s přestavovými body.',
    tolerance: { xy: 0.003 },
    levelFrom: 'NZ-Kn-15',
    levelTo: 'vb2',
    pay: 6400,
    kit: ['level', 'rod'],
    difficulty: 3,
  },
  {
    id: 'louka-kulna',
    title: 'Zaměření polní kůlny',
    client: 'Zemědělské družstvo Kněžívka',
    location: 'louka',
    type: 'polohopis',
    brief:
      'Družstvo chce kůlnu u cesty zapsat do katastru. Zaměř všechny čtyři rohy s kódem roh budovy. Kůlna je nízká, GNSS u ní FIX udrží. Hrot postav přesně do rohu, mezní odchylka 10 cm.',
    tolerance: { xy: 0.1 },
    featureIds: ['kulna-SZ', 'kulna-SV', 'kulna-JV', 'kulna-JZ'],
    pay: 3600,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 1,
  },
  {
    id: 'louka-mez',
    title: 'Zaměření kamenů na mezi',
    client: 'Marie Dvořáková, vlastnice',
    location: 'louka',
    type: 'polohopis',
    brief:
      'Pod stromořadím na mezi GNSS nedá FIX. Postav stanici na 5102 a orientuj ji na hraniční znak 302 (nebo volné stanovisko), pak zaměř tři hraniční kameny na mezi s kódem Hranice – výtyčku s hranolem postav na každý kámen.',
    tolerance: { xy: 0.05 },
    featureIds: ['mez-1', 'mez-2', 'mez-3'],
    requireStation: true,
    stationAt: 'PBPP-5102',
    orientOn: 'HZ-302',
    stationTask: 'Zaměř tři kameny na mezi (hranol na kámen, kód Hranice)',
    pay: 7800,
    kit: ['tripod', 'tsCase', 'prismPole'],
    difficulty: 3,
  },
  {
    id: 'les-cesta',
    title: 'Zaměření propustku na lesní cestě',
    client: 'Lesy obce Hrušov',
    location: 'les',
    type: 'polohopis',
    brief:
      'V lese pod korunami GNSS nedá ani FLOAT a bodové pole tam není. Na cestě před lesem si GNSS stabilizuj dva pomocné body (8001 blíž k lesu, 8002 dál), zkontroluj se na bodu 6101. Pak postav stanici na 8001, orientuj ji na 8002 a do lesa zaměř oba konce propustku (kód Propustek), hraniční kámen u cesty (Hranice) a patu památného dubu (Strom).',
    tolerance: { xy: 0.06 },
    featureIds: ['propustek-vtok', 'propustek-vytok', 'les-hranice', 'les-dub'],
    requireStation: true,
    helperPoints: [
      { x: -62, z: 0 },
      { x: -140, z: 0 },
    ],
    stationAt: 'PB-8001',
    orientOn: 'PB-8002',
    stationTask: 'Zaměř propustek, kámen a dub (hranol na prvek, správný kód)',
    pay: 12400,
    kit: ['gnssCase', 'gnssRover', 'tripod', 'tsCase', 'prismPole'],
    difficulty: 3,
  },
  {
    id: 'les-studanka',
    title: 'Studánka v průseku (polygonový pořad)',
    client: 'Obec Hrušov, odbor životního prostředí',
    location: 'les',
    type: 'polohopis',
    brief:
      'Studánka leží v průseku hluboko v lese – z louky na ni není vidět a GNSS tam nedá FIX. Pomocné body 8001 a 8002 před lesem (když ještě nejsou, stabilizuj je GNSS), stanice na 8001 s orientací na 8002. U ústí průseku stanicí stabilizuj bod pořadu 8101, stanici na něj přestav, orientuj zpět na 8001 a zaměř studánku (kód Studánka) a hraniční kámen na konci průseku.',
    tolerance: { xy: 0.07 },
    featureIds: ['les-studanka', 'les-hranice-2'],
    requireStation: true,
    helperPoints: [
      { x: -62, z: 0 },
      { x: -140, z: 0 },
    ],
    traverse: [{ x: 40, z: -1 }],
    stationAt: 'PB-8001',
    orientOn: 'PB-8002',
    stationTask: 'Z bodu 8101 zaměř studánku a hraniční kámen v průseku',
    pay: 14600,
    kit: ['gnssCase', 'gnssRover', 'tripod', 'tsCase', 'prismPole'],
    difficulty: 3,
  },
  {
    id: 'stavba-pripojka',
    title: 'Vodovodní přípojka před zásypem',
    client: 'Vodovody a kanalizace Polabí',
    location: 'stavba',
    type: 'polohopis',
    brief:
      'Na stavbě je otevřený výkop nové vodovodní přípojky. Zaměř skutečné provedení: konec u domu, oba lomy a napojení na řad (kód Vodovod), hrot na vrch modré trubky. Bagrista zasype výkop dvě hodiny po převzetí zakázky – co nestihneš, už nikdo nezjistí.',
    tolerance: { xy: 0.1 },
    featureIds: ['vodovod-1', 'vodovod-2', 'vodovod-3', 'vodovod-4'],
    deadlineMin: 120,
    pay: 5600,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 2,
  },
  {
    id: 'louka-gp',
    title: 'Geometrický plán: kůlna na louce',
    client: 'Zemědělské družstvo Kněžívka',
    location: 'louka',
    type: 'polohopis',
    brief:
      'Družstvo chce kůlnu zapsat do katastru. Zaměř GNSS všechny čtyři rohy (kód Roh budovy) a pásmem změř oměrné míry všech čtyř stran – s prázdnýma rukama zamiř na roh, přilož pásmo (Pepa drží nulu) a u sousedního rohu odečti. Oměrné míry musí sedět se souřadnicemi do 8 cm. Výstup: geometrický plán.',
    tolerance: { xy: 0.08 },
    featureIds: ['kulna-SZ', 'kulna-SV', 'kulna-JV', 'kulna-JZ'],
    tape: [
      ['kulna-SZ', 'kulna-SV'],
      ['kulna-SV', 'kulna-JV'],
      ['kulna-JV', 'kulna-JZ'],
      ['kulna-JZ', 'kulna-SZ'],
    ],
    output: 'gp',
    pay: 8600,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 2,
  },
  {
    id: 'louka-hranice',
    title: 'Vytyčení hranice pozemku 812/5',
    client: 'Marie Dvořáková, vlastnice',
    location: 'louka',
    type: 'vytyceni',
    brief: 'Obnov hranici pozemku. Dochované znaky 301 a 302 ověř měřením, chybějící lomy 303 a 304 vytyč kolíky. Mezní odchylka 3 cm.',
    tolerance: { xy: 0.03 },
    stake: 'hranice',
    pay: 7400,
    kit: ['gnssCase', 'gnssRover'],
    difficulty: 2,
  },
];
