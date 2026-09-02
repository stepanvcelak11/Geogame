# Geodetická síť — jak hru dostat na telefon

Hra je **jediný soubor** `index.html`. Nepotřebuje server, databázi ani internet.

## A) Nejrychleji: Netlify Drop (bez registrace)

1. Stáhni si `index.html` z chatu do telefonu.
2. Otevři **netlify.com/drop** v prohlížeči.
3. Nahraj soubor. Dostaneš adresu typu `nazev.netlify.app`.
4. V Chromu otevři adresu → menu (tři tečky) → **Přidat na plochu**.

Aktualizace: nahraješ nový `index.html` na stejné místo, v aplikaci se projeví po zavření a otevření.

## B) GitHub Pages (trvalá adresa, taky z mobilu)

1. **github.com** → přihlas se → **New repository**
   - jméno například `geodeticka-sit`, viditelnost **Public**, potvrď **Create**
2. V repozitáři → **Add file** → **Upload files** → vyber stažený `index.html` → **Commit changes**
3. **Settings** → v levém menu **Pages** → Source: **Deploy from a branch**,
   branch **main**, složka **/ (root)** → **Save**
4. Za minutu běží na `https://TVOJE-JMENO.github.io/geodeticka-sit/`
5. Otevři adresu v Chromu → **Přidat na plochu**

Aktualizace: v repozitáři **Add file → Upload files**, nahraj nový `index.html`,
potvrď **Commit changes** (přepíše starý). Do minuty je venku.
V aplikaci pak stáhni stránku dolů (obnovení) nebo ji zavři a otevři znovu.

## Postup ve hře při aktualizaci

Postup je uložený v prohlížeči a je vázaný na adresu.
Před výměnou verze nebo při přechodu na jinou adresu:

- **Nastavení → Záloha postupu → ZKOPÍROVAT** (kód si ulož třeba do poznámek)
- v nové verzi **Nastavení → Obnovit ze zálohy → VLOŽIT**

Číslo verze je vidět dole na hlavní obrazovce a v Nastavení — podle něj poznáš,
jestli se aktualizace opravdu načetla.

## Poznámky

- Hra běží celá offline, i po přidání na plochu.
- Funguje v Chromu, Edge i Safari; nejlépe na výšku.
- Data se neposílají nikam ven, všechno zůstává v telefonu.
