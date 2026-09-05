# Měřicí nástroje k GeoGame

Nic z téhle složky se **nenahrává na hosting** — jsou to jen nástroje, kterými se
dá změřit, co udělá změna balancu. Vzniklo 4. 9. 2026.

## Co tu je

| soubor | k čemu |
|---|---|
| `bot.js` | robot, který hru odehraje bez člověka |
| `ab.py` | pustí ho na jeden nebo víc souborů hry a vypíše srovnání |
| `male-pismo.md` | naměřený seznam všech míst s písmem pod 12 px |

## Jak to pustit

Potřebný je Playwright pro Python (na tomhle stroji je nainstalovaný).

```
cd C:\Users\stepa\Desktop\geogame\mereni
python ab.py ..\index.html                       # změří jeden soubor
python ab.py stara-kopie.html ..\index.html      # A/B srovnání dvou
```

Jeden průchod trvá zhruba minutu a odehraje kolem 230 etap.

## Co robot umí a co ne

**Umí:** staví z nabídky skladu na pole s nejlepším pokrytím trasy, slučuje všechny
dvojice stejného druhu a řady, kupuje vylepšení sítě a kalibruje nejvyšší řady,
dokud má z čeho.

**Neumí:** měřické metody, nouzovou opravu přesnosti, přehazování nabídky za
rozpočet, výběr sestavy, přesouvání stanovisek ani prodej. Startuje vždy s čistým
postupem — bez karet, bez laboratoře, bez trofejní cesty.

**Proto:** je to model *slušného, ale ne skvělého hráče bez nasbíraného postupu*.
Čísla z něj se hodí na **srovnání dvou verzí mezi sebou**, ne jako absolutní
tvrzení o tom, co zvládne člověk. Když se dvě měření rozejdou, skoro vždy je to
tím, že každý robot hraje jinak dobře — vždycky pouštět **tentýž** robot na obě
verze.

## Čemu ve výstupu věnovat pozornost

- `etap s castecnou ztratou` — jak často se ukazatel přesnosti vůbec hne. Když je
  to skoro nula, je přesnost jen přepínač živý/mrtvý a hráč nemá zpětnou vazbu.
- `etap od prvni ztraty do konce` — kolik etap má hráč na to, aby prohru odvrátil.
- `vysledky` — u každého území zbylá přesnost a jestli ho robot dohrál.

Samotné „kam až robot došel“ je zavádějící: po zavedení vytyčeného pásu se dostane
skoro všude a brzdí ho spíš kapacita než obtížnost.
