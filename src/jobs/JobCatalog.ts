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
  levelFrom?: string; // nivelace: výchozí značka (ID)
  levelTo?: string; // nivelace: určovaný bod (ID prvku)
  pay: number; // odměna [Kč]
  kit: ItemKind[]; // potřebné vybavení
  difficulty: 1 | 2 | 3;
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
    kit: ['gnssRover'],
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
    kit: ['gnssRover'],
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
    kit: ['gnssRover'],
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
    kit: ['gnssRover'],
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
    kit: ['gnssRover'],
    difficulty: 1,
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
    kit: ['gnssRover'],
    difficulty: 2,
  },
];
