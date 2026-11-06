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
| L1 | Poziom 1 „Rozruch”: rozbieranie złomu, fabrykator (kabel 5 m = 1 miedź + 1 plastik), stacja jako źródło, ładowanie żaglowozu, odjazd sterem; zoom | ✅ |
| M3 | Sieć: kołki (zamrażają trasę), extender 4 porty, tryby portu OUT / IN / RÓWN (F), bilans, nakładka Alt | ⏳ |
| M4 | Wolt: energia i kadłub, zryw, cykl dnia i nocy, lampa sodowa, burza pyłowa | ⏳ |
| M5 | Rozbieranie złomu, recykler, fabrykator, 4 surowce; cel: przekaźnik Stacji 2 przez 60 s | ⏳ |
| M6 | Dźwięk 2: warstwy ambientu zależne od pory dnia i burzy, dźwięki maszyn w przestrzeni | ⏳ |
| M7 | Sterowanie dotykowe i pad | ⏳ |
| F1 | Feedback: pokład z europalet na stalowej ramie, bateria Wolta (zużycie, ładowanie na postoju i przy porcie), światło L, beczki do rozebrania, sterowanie myszą z menu kontekstowym, żagiel przezroczysty, gdy zasłania Wolta | ✅ |
| W1 | Wolt-monocykl (etap 1 „Rdzeń”, `src/render/wolt.ts`): koło, kapsuła z ogniwem Q-1, ramię serwisowe od startu, bęben kabla z prowadnicą, hak. Balansowanie i przechył (zakręty, hamowanie, ciągnięcie kabla i ładunku), kabel wychodzi z bębna, bęben kręci się przy wydawaniu i zwijaniu, koło buksuje, gdy kabel albo ładunek trzyma. Holowanie (`src/sim/tow.ts`): opona i sanki z cegłami na linie 1,5 m, E doczep / odczep, spowolnienie i większy pobór energii, zaczepianie o przeszkody, ślady w popiele | ✅ |

## Zasady kabla (M2)

- Kabel to metry na nawijaku Wolta (60 m). Odcinek ma maks. **20 m**, liczone wzdłuż kabla.
- Kabel zachowuje się jak napięty sznurek: zakręca na wypukłych rogach zablokowanych kafli i odwija się, gdy Wolt wraca.
- Od 18 m kabel świeci na pomarańczowo, a Wolt zwalnia o 30%. Przy 20 m Wolt może iść już tylko po okręgu zasięgu.
- `E` przy wolnym porcie: weź kabel. `E` przy porcie docelowym: wepnij (jeśli trasa się mieści). `E` przy wpiętym końcu: wypnij.
- `Q` (przytrzymaj 0,5 s): zwiń trzymany kabel albo kabel wpięty w port obok.

## Poziom 1 „Rozruch”

Bateria żaglowozu jest pusta, a Wolt nie ma kabla. Za ścianą kontenerów stoi Stacja 2 ze sprawnymi panelami (600 W).

1. Rozbierz złom i beczki (kliknij albo przytrzymaj `E` przy kupce). 7 kupek i 2 beczki dają razem 6 miedzi, 7 plastiku, 8 żelaza i 1 szkło.
2. Przy fabrykatorze (północna burta żaglowozu) `E` robi 5 m kabla z 1 miedzi i 1 plastiku. Potrzeba 20 m.
3. Weź kabel z portu stacji albo żaglowozu i wepnij w drugi port. Trasa od północy ma ok. 18,4 m, a od południa jest za długa.
4. Bateria 2 kWh ładuje się ok. 25 s (czas gry jest przyspieszony).
5. `E` przy sterze (rufa, zachodnia burta) i żaglowóz odjeżdża. Wpięty kabel wyskakuje z portu.

## Bateria Wolta

Wolt ma własne ogniwo 100 Wh i zaczyna z 25 Wh.

| Stan | Wh/s |
|---|---|
| czuwanie | −0,03 |
| marsz | −0,3 |
| bieg | −1,0 |
| rozbieranie | −1,5 |
| światło | −0,2 |
| postój (po 1 s) | +0,8 |
| postój przy żywym porcie (Stacja 2, naładowany żaglowóz) | +4 |

Na pustej baterii Wolt wlecze się (40% prędkości), nie biega, nie rozbiera, a światło gaśnie.
