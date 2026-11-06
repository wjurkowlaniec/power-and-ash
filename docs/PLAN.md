# Plan implementacji

Stack: **Three.js + TypeScript + Vite**. Kamera ortograficzna pochylona nad płaską siatką kafli 3D, 1 kafel = 1 m.
Logika gry (siatka, kabel, sieć energetyczna) jest w `src/sim/` w czystym TS, bez importów Three.js, i ma testy (Vitest).
Render (`src/render/`) i dźwięk (`src/audio/`) tylko czytają stan gry.

Kierunek artystyczny: wyblakła paleta popiołu, mgła, miękkie światło, ciemne sylwetki. Kolor jest zarezerwowany
dla tego, co ważne: lampa Wolta, napięty kabel, przekaźnik stacji. Dźwięk: ambient otoczenia (wiatr, podmuchy,
odległy metal z pogłosem), robiony proceduralnie w Web Audio, bez plików audio.

## Kamienie milowe

| # | Zakres | Status |
|---|--------|--------|
| M1 | Szkielet: Vite + TS + Three.js, podział sim / render, testy, deploy na GitHub Pages | ✅ |
| M2 | MVP: ruch WASD z kolizjami, kabel z portu (E), owijanie o przeszkody, 20 m wzdłuż trasy (od 18 m ostrzeżenie i spowolnienie), wpięcie w port stacji, stacja się zapala; Q zwija; ambient | ✅ |
| M3 | Sieć: kołki (zamrażają trasę), extender 4 porty, tryby portu OUT / IN / RÓWN (F), bilans, nakładka Alt | ⏳ |
| M4 | Wolt: energia i kadłub, zryw, cykl dnia i nocy, lampa sodowa, burza pyłowa | ⏳ |
| M5 | Rozbieranie złomu, recykler, fabrykator, 4 surowce; cel: przekaźnik Stacji 2 przez 60 s | ⏳ |
| M6 | Dźwięk 2: warstwy ambientu zależne od pory dnia i burzy, dźwięki maszyn w przestrzeni | ⏳ |
| M7 | Sterowanie dotykowe i pad | ⏳ |

## Zasady kabla (M2)

- Kabel to metry na nawijaku Wolta (60 m). Odcinek ma maks. **20 m**, liczone wzdłuż kabla.
- Kabel zachowuje się jak napięty sznurek: zakręca na wypukłych rogach zablokowanych kafli i odwija się, gdy Wolt wraca.
- Od 18 m kabel świeci na pomarańczowo, a Wolt zwalnia o 30%. Przy 20 m Wolt może iść już tylko po okręgu zasięgu.
- `E` przy wolnym porcie: weź kabel. `E` przy porcie docelowym: wepnij (jeśli trasa się mieści). `E` przy wpiętym końcu: wypnij.
- `Q` (przytrzymaj 0,5 s): zwiń trzymany kabel albo kabel wpięty w port obok.
