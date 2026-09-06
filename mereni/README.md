# Měřicí nástroje k GeoGame

Nic z téhle složky se **nenahrává na hosting** — jsou to jen nástroje, kterými se
dá změřit, co udělá změna balancu. Vzniklo 4. 9. 2026.

## Co tu je

| soubor | k čemu |
|---|---|
| `bot.js` | robot, který hru odehraje bez člověka |
| `vlna.py` | měřidlo „projde vlna“ — síla přístrojů a síla vlivů |
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

## Měřidlo „projde vlna“ (`vlna.py`)

Robot odpovídá na otázku *dohraje se to?*. Na otázku *je tenhle přístroj slabý?*
nebo *jak nebezpečný je tenhle vliv?* je hrubý — proto vzniklo druhé měřidlo.
Cíle v něm jdou po trase **normální rychlostí**, takže umí ocenit i dosah
a zpomalení.

```
python vlna.py vlivy       # naměřená síla jednotlivých vlivů
python vlna.py pristroje   # poškození na 1 rozpočtu podle přístroje a řady
```

**`pristroje`** postaví čtyři stejná stanoviska a pustí na ně vlnu cílů s tak
vysokou odolností, že nikdo neumře; poškození se sbírá obalením `hurt()`, takže
se nic neztratí ani na cíli, který mezitím projde. Dělí se cenou → *škoda na
1 rozpočtu*.

**`vlivy`** postaví pevnou obranu a pustí na ni vlnu z jediného druhu vlivu.
Každý druh dostane **stejný počet kusů i stejnou odolnost na kus** (násobek se
dopočítá z jeho základní odolnosti), takže se druhy liší **už jen chováním** —
rychlostí, pancířem, regenerací, umlčováním, léčením, krytím. Měří se podíl
vlny, který projde k nulovému bodu, vztažený k „Chybě odečtu“ = 1,00.

### Na co si u něj dát pozor

- **Zmrazené cíle neměří dosah ani zpomalení.** Starší varianta tohohle měřidla
  držela cíle na místě; jednocílový přístroj pak má pořád na co střílet a
  „Rozhledové body“ vyjdou na nulu. Proto se cíle hýbou.
- **„Škoda na 1 rozpočtu“ neunese tvrzení „je moc silný“**, jen „nedělá to nic“.
  Hustá vlna nadhodnocuje všechno, co bije po ploše: hrdinu vyhodnotila jako 8×
  nad křivkou, a odehraný běh přitom ukázal, že bez hrdiny je robot **lepší**.
  Na „je moc silný“ platí jedině odehraný běh.
- **Umístění umí měřidlo obelstít.** Pentagon měří jen po své řadě a sloupci —
  postavený „co nejblíž trase“ vypadá slabě, postavený podle osy udělá o 40 %
  víc. Hranol vyšel jako „nedělá nic“, protože stál 2,24 pole daleko při
  dosahu 2,2.
- **Režim `vlivy` je vlna z jediného druhu.** Zákryt tedy kryje jen zákryty a
  léčitel léčí jen léčitele; v míchané vlně to dopadne jinak. Obrana navíc
  obsahuje niveláky, a drift regeneruje jen dokud není zpomalený.

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
