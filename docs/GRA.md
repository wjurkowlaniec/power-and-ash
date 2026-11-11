# Gra: jak jest zbudowana i co już działa

Ten dokument opisuje **kod gry** (`src/game/`): architekturę, stan scen względem [POCZATEK.md](POCZATEK.md), decyzje Wojtka dotyczące gry i sposób pracy. Świat i fabuła są w [SWIAT.md](SWIAT.md), a kolejne sceny w [POCZATEK.md](POCZATEK.md). Tech demo („Rozruch”) opisuje [PLAN.md](PLAN.md).

Dokument musi być aktualny. Każdy PR, który zmienia grę, aktualizuje też odpowiednią sekcję tutaj.

## Uruchomienie i testy

```bash
npm install
npm run dev     # http://localhost:5173/power-and-ash/  (gra), /power-and-ash/demo/ (tech demo)
npm test        # Vitest: logika scen, kabel, holowanie, notatki
npm run build   # tsc --noEmit + vite build do dist/
```

- `?scene=<id>` przeskakuje do sceny, np. `?scene=hall` albo `?scene=station`. Identyfikatory są w `src/game/main.ts`.
- W konsoli przeglądarki stan sceny jest dostępny jako `window.hall` albo `window.station`. Można go zmieniać ręcznie, np. `station.turbine = true`.
- Zrzuty ekranu z Playwright w chmurze: `vite preview` w headless Chromium zwraca 404 dla skryptów. Trzeba skopiować `dist/` do katalogu `www/power-and-ash/` i podać go przez `python3 -m http.server`.

## Architektura

Gra i tech demo to jedno repo i jeden build Vite z dwiema stronami (`vite.config.ts`, `rollupOptions.input`):

| Strona | Wejście | Kod |
|---|---|---|
| gra `/power-and-ash/` | `index.html` | `src/game/**` |
| tech demo `/power-and-ash/demo/` | `demo/index.html` | `src/main.ts`, `src/sim/game.ts`, `src/sim/level.ts`, `src/render/view.ts` |

**Wspólny silnik** (zmiany uzgadniać z wątkiem dema):

- `src/sim/`: `vec`, `world` (siatka i przeszkody), `cable` (kabel owijający się o rogi przeszkód), `tow` (holowanie na linie), `drive` (płynna jazda monocyklem: kurs, skręt, przyspieszanie, opona na linie), `path` (A*), `power`, `wind`
- `src/render/groundFx.ts`: ślady koła i opony zależne od podłoża, pył przy buksowaniu
- `src/i18n.ts`: `tr('pl', 'en')` w miejscu tekstu; język z `?lang=`, z zapisanego wyboru albo z przeglądarki
- `src/render/`: `palette`, `assets` (modele CC0), `models`, `wolt.ts` (monocykl Wolta i jego animator), `loads.ts` (opona, sanki)

**Gra** (`src/game/`):

| Plik / katalog | Rola |
|---|---|
| `main.ts` | ładuje modele, wejście z klawiatury, mapa scen `scenes`, pętla gry |
| `sim/clickWalk.ts`, `scenes/mouse.ts` | point-and-click: klik → ten sam kierunek i E co z klawiatury (test: `test/clickWalk.test.ts`) |
| `scene.ts` | interfejsy `Scene` (`enter` / `update` / `exit` / `next`) i `Ctx` (fx, dźwięk, modele, HUD, wejście) |
| `state.ts` | to, co przechodzi między scenami w jednym przejściu gry (np. naładowanie baterii) |
| `sim/*.ts` | **czysta logika** sceny, bez Three.js, z testami w `test/` (`Hall`, `Station`) |
| `render/*View.ts` | scena 3D: czyta stan logiki co klatkę i nic w nim nie zmienia |
| `render/station/*` | części widoku Sceny 2 (budynek, podwórze, tło, wnętrza, maszyny, atmosfera, życie), opis niżej |
| `render/post.ts` | post-process: tone mapping, „szarość poza zielenią” w trybie rezerwy, wyblakła paleta |
| `render/cableTube.ts` | rura kabla leżącego na ziemi; krzywa jest gęsto próbkowana, żeby nie wchodziła pod podłogę |
| `scenes/*.ts` | klej: logika + widok + dźwięk + HUD; zdarzenia logiki (`events`) zamieniają się w dźwięki |
| `fx.ts` | nakładka 2D: ziarno, szum obrazu, zielona kropka, czarne wyciemnienie |
| `audio/sound.ts` | `GameSound`, proceduralny dźwięk w Web Audio (wiatr, skrzypienie koła, brzęk, puls) |
| `notes.ts` | notatki, korpus, odkodowanie pisma, archiwum (`localStorage`, klucz `pip.notes`) |
| `game.css` | HUD, karta notatki, linijka celu |

Zasady kodu:

- Logika sceny nie importuje Three.js i jest w pełni testowalna. Widok tylko czyta stan.
- Zdarzenia logiki to krótkie nazwy w `events: string[]`. Scena opróżnia je co klatkę.
- Teksty dla gracza są w logice (`hint()`, `goal()`, `say()`) i zawsze w dwóch językach przez `tr('pl', 'en')`. Polski jest oryginałem (od niego liczy się korpus notatek).
- `localStorage` zawsze w `try/catch`.

## Sceny: stan wdrożenia

| Scena z POCZATEK.md | id | Stan |
|---|---|---|
| 0. Ciemność | `darkness` | działa: 20 s, puls, kropka, przytrzymana spacja pomija |
| 1. Hala pomiarowa | `hall` | działa: zdalne sterowanie pustym monocyklem po kablu diagnostycznym (9 m), dźwignia + rura, bateria w kasecie, kolor i dźwięk wracają |
| 2. Martwa stacja | `station` | działa od początku do wyjazdu przez bramę (niżej); maszynownia od środka i suwnica są na później |
| 4. Odjazd | `odjazd` | karta „w budowie”, na nią kończy się Scena 2 |
| 3–8 | | jeszcze nie ma |

### Scena 2 w obecnej wersji

1. Port na lewo od drzwi warsztatu: E wpina kabel własny Wolta (3 m), zamek puszcza, kosztuje to 6% baterii.
2. Fabrykator odmawia: potrzebuje 600 W, a Wolt daje 200 W.
3. Opona z podwórza jak sanie (E doczepia, **Q zawsze odczepia**). W magazynie, na drugiej półce, leży moduł transformatora. Moduł trafia na oponę.
4. Turbina kręci się od początku, ale szafka transformatora u stóp masztu ma spalony moduł (czerwona lampka, iskry). Z modułem na oponie przy szafce: przytrzymać E, lampka robi się zielona, prąd z turbiny płynie. Bez drabinki, bo Wolt ma koło.
5. Pod masztem stoi bęben z **18 m kabla**. E bierze koniec, kabel owija się o przeszkody, Q odkłada, E podnosi. Koniec kabla trafia do przyłącza na ścianie maszynowni od strony podwórza. Maszynownia budzi się (światło, lampka).
6. Bilans Q-1 w %/s i panel „Sieć stacji” (turbina, Wolt, maszynownia, fabrykator).
7. Notatki: kartka technika (pismo odręczne, dwa rysunki), pismo kierowniczki w szufladzie, mapa sieci, dwie książki na półce w dyżurce.
8. `PLOT_DELAY` (3 s) po zasileniu maszynowni ploter w dyżurce drukuje stronę (dźwięk, kartka wysuwa się z plotera). E skanuje ją jako notatkę `mapaR2` (pismo `image`, czytelna od razu): rysunkowa mapa drogi do R-2, 4,2 km.
9. Brama w płocie na południu (`P.gate`): bez mapy odmawia („dokąd?”), z mapą E zaczyna wyjazd. Wolt sam toczy się przez bramę `LEAVE_TIME` (6 s), potem wyciemnienie i karta `odjazd`.
10. Zajawki metroidvanii: zielona poświata za oknem maszynowni (wnętrze niedostępne), szopa na kłódkę, wyrzutnia balonów, fabrykator bez mocy.

### Wygląd i animacje Sceny 2

Prośba Wojtka z 2026-11-11: upiększyć poziom i dopracować szczegóły oraz animacje. Zasady rozgrywki się nie zmieniły. `stationView.ts` tylko składa części z `src/game/render/station/`:

| Plik | Co buduje |
|---|---|
| `models.ts` | dogrywa modele sceny: `src/assets/station/` (pakuje je `tools/pack-station-models.mjs`) i wybrane z `src/assets/craft/`; wszystkie przygaszone w stronę popiołu |
| `kit.ts` | wspólne klocki: tekstury z canvasu, poświata (`glow`), shader dziury wokół Wolta (`Hole`), `groundY`, wstęgi na ziemi |
| `building.ts` | budynek stacji: ściany z przeszkód logiki, cokół, okna, wiaty z lampami, tabliczki z piktogramami, dach z panelami, świetlikami, wentylatorem i masztem pomiarowym |
| `interiors.ts` | warsztat (fabrykator, stół, szafa narzędziowa), dyżurka (biurko, komputer, lampka, kanapa, mapa ścienna, tablica z rysunkiem dziecka, regał), magazyn (regały z towarem, paleta) |
| `yard.ts` | podwórze: ścieżki i kałuże, kratowy maszt turbiny z głowicą ustawioną do wiatru, rękaw, reflektor, wyrzutnia balonów, szopa, kuty płot z bramą, trawy, krzaki, wrony |
| `backdrop.ts` | to, co poza mapą: świerkowy las we mgle, droga z koleinami za bramą, betonowy znak „OLSZANKA”, ławka, słupy z przewodami |
| `machines.ts` | animowane urządzenia: szafka transformatora, lot modułu z półki na oponę, ploter, bęben kabla, drzwi warsztatu |
| `atmosphere.ts` | wiatr (`WIND`), płaty mgły, opad popiołu, przygaszanie odległych rzeczy do koloru mgły |
| `life.ts` | rękaw, anemometr, wrony (podrywają się, gdy Wolt podjedzie na 4 m) |
| `wake.ts` | kolejność i czasy budzenia się stacji po zasileniu (`WAKE`) |
| `batch.ts` | `mergeStatic`: wszystko, co się nie rusza, jest scalane po materiale (ok. 120 wywołań rysowania na klatkę); `userData.live` wyłącza obiekt ze scalania, `userData.sway` dodaje falowanie na wietrze w shaderze |

Animacje wynikają tylko ze stanu logiki, widok niczego w nim nie zmienia:

- **Transformator** (`st.repair`): drzwiczki się otwierają, spalony moduł wysuwa się i ląduje na ziemi, nowy wjeżdża z opony, drzwiczki się zamykają, lampka zmienia się z czerwonej na zieloną, iskry i dym znikają.
- **Moduł z półki** (`st.shelfTaken`): moduł przelatuje łukiem z regału na oponę.
- **Ploter** (`st.plotted`): karetka z pisakiem rysuje mapę przez ok. 5 s (`PLOT_TIME`), dźwięk trwa tyle samo.
- **Budzenie stacji** (`st.poweredT`): maszynownia, magazyn, dyżurka, warsztat, hala, lampy nad drzwiami i reflektor na podwórzu zapalają się po kolei z migotaniem; każda część ma swoje kliknięcie i buczenie (`scenes/station.ts`).
- **Wyjazd** (`st.leaving`): skrzydło bramy otwiera się na sprężynie, kamera lekko się oddala.
- **Tło**: wirnik i głowica turbiny, anemometry, rękaw, wentylator na dachu, trawa, mgła, popiół, powłoka balonu w wyrzutni.

Nowe przeszkody w logice (`sim/station.ts`), żeby meble nie były przenikalne: szafa narzędziowa w warsztacie, szafka i kanapa w dyżurce, paleta w magazynie.

Propozycje agenta do potwierdzenia: czasy budzenia (`WAKE`), kierunek wiatru, wygląd znaku „OLSZANKA” przy drodze (nazwa stacji jest z SWIAT.md).

### Skraj mapy i przegląd logiki (2026-11-11)

**Skraj mapy.** Decyzja Wojtka: świat jest otwarty, więc mapa nie ma ściany na brzegu. Na stacji działa to tak (`sim/station.ts`):

- `OpenWorld` otwiera zachodni, wschodni i północny bok siatki. Zamknięte zostają tylko miejsca, gdzie stoi płot: całe południe oraz boki od rogów do `FENCE_WEST_Y` i `FENCE_EAST_Y`.
- `bogDepth(p)` mówi, jak głęboko punkt leży w sypkim popiele poza ubitym placem. Przyczepność spada liniowo do zera na `BOG_DEPTH` (2,5 m). Koło dalej się kręci (`strain`, pył, zdarzenie `bog` z dźwiękiem), Wolt zapada się w popiół (`st.bog`, widok obniża go o 14 cm), a buksowanie zjada baterię.
- Powrót zawsze działa: w stronę ubitego gruntu zostaje co najmniej `BOG_BACK` (45%) prędkości. Nie ma martwego punktu.
- Komunikat mówi wprost: ubita jest tylko droga za bramą.
- `src/sim/path.ts` (wspólny silnik) szuka drogi także wtedy, gdy start albo cel leży poza siatką. Dla zamkniętych światów nic się nie zmienia.

**Przegląd logiki.** Przeszedłem wszystkie interakcje sceny (port, drzwi, kartka, fabrykator, szuflada, mapa ścienna, książki, półka, opona, szafka transformatora, bęben, koniec kabla, przyłącze, drzwi maszynowni, ploter, brama). Poprawione:

- Oponę da się doczepić także po naprawie turbiny. Wcześniej opona zostawiona w drzwiach (np. dyżurki) mogła zamknąć Wolta w pokoju na stałe.
- Linijka celu nie wraca do „drzwi warsztatu”, gdy gracz pominie warsztat i od razu ciągnie oponę albo moduł (warsztat jest opcjonalny).
- Panel „Sieć stacji” pojawia się także po naprawie turbiny, a nie tylko po otwarciu warsztatu.
- Fabrykator mówi prawdę o stanie: brak turbiny, turbina bez kabla, zasilony.
- Klik w zamknięte drzwi warsztatu albo w przewróconą szafę prowadzi Wolta pod drzwi od podwórza (punkty użycia były w środku ściany i szukanie drogi mogło wybrać stronę nie do osiągnięcia).
- Odmowa przy półce nie powtarza dźwięku co klatkę, a dźwięk naprawy nie zależy już od losowania.

Testy w `test/station.test.ts`: każda interakcja jest osiągalna, opona w drzwiach, grzęźnięcie i powrót, płoty.

**Różnice względem POCZATEK.md** (do uzgodnienia lub do dorobienia):

- Moduł transformatora leży gotowy na półce. Nie ma jeszcze rozbiórki złomu. Łożyska i drabinki nie ma celowo: Wolt ma koło i się nie wspina (Wojtek 2026-11-09).
- Zamiast szpuli 12 m przez okno dyżurki jest bęben 18 m pod masztem, a przyłącze maszynowni jest od strony podwórza. To odpowiedź na uwagę Wojtka, że poziom urywał się po turbinie.
- Suwnicy, wnętrza maszynowni i działającego fabrykatora jeszcze nie ma. Światła w całej stacji zapalają się już pokój po pokoju, ale tylko jako obraz i dźwięk (bez osobnej mechaniki). Echo w Scenie 4 zastąpiła (na razie) mapa z plotera.

## Decyzje Wojtka dotyczące gry

Pełne sformułowania i kontekst są w wątkach projektu, a tutaj są ich skróty z datą.

- **2026-11-06** Prototyp zostaje jako **tech demo** do testowania mechanik. Prawdziwa gra powstaje równolegle według POCZATEK.md i dzieli silnik.
- **2026-11-06** Każda zmiana trafia od razu na GitHub Pages do testów: PR, zielone CI, squash-merge, deploy.
- **2026-11-06** Scena 0 ma być krótka (20 s, kropka po ok. 2,5 s). Na rezerwie Wolt jedzie wolno, ale równo, a nie coraz wolniej.
- **2026-11-06** Dźwignia musi być zrozumiała: rura połyskuje po pierwszej próbie, a podpowiedź niesie notatka (teraz: rysunek).
- **2026-11-06** Bateria Q-1 zostaje kwantowa. Historia i wskazówki płyną z notatek znajdowanych w świecie, jak w Control.
- **2026-11-07** Wolt w grze to wspólny monocykl z dema: ramię, kabel z bębna wpływa na przechył, obrót tylko w kierunku jazdy, skrzypienie koła zamiast kroków.
- **2026-11-07** Nie może być martwych punktów: hol zawsze da się odczepić (Q), opona nie może zablokować ruchu, a na postoju Q-1 powoli odzyskuje energię (0,15%/s, widoczne w panelu). Cel ma być czytelny: cicha linijka celu i podpowiedzi mówiące, czego brakuje.
- **2026-11-07** Budynki mają dachy. Kiedy dach albo ściana zasłania Wolta, znika tylko miękkie koło wokół niego, jak w Control Resonant (shader dziury, teraz `Hole` w `render/station/kit.ts`).
- **2026-11-07** Poziom nie powinien kończyć się na turbinie: prąd trzeba jeszcze doprowadzić kablem do maszynowni. Uwagi Wojtka to obserwacje, a nie ścisła specyfikacja.
- **2026-11-08** Q-1 nie rozumie ludzkiego pisma. Notatki są na start nieczytelne, a korpus odkodowuje je progami: liczby i ostrzeżenia (450 znaków), druk techniczny (1400), zwykły druk (3500), pismo odręczne (7000). Wczesne wskazówki niosą rysunki. Szczegóły są w SWIAT.md, sekcja „Notatki i archiwum”.
- **2026-11-08** Kabel nie może znikać pod podłogą (`cableTube`).
- **2026-11-08** Gra i demo mają wersję angielską (przełącznik PL · EN na ekranie startowym). Bateria pokazuje bilans prądu, a jazda jest płynna (wspólne `drive.ts`).
- **2026-11-09** Wolt ma koło, więc nie wspina się po drabinkach: zamiast łożyska na szczycie masztu naprawia się **transformator** w szafce u stóp masztu. Scena 2 ma się kończyć wyruszeniem dalej, z elementami metroidvanii (coś fajnego widać, ale jeszcze nie da się wejść). Pisma ludzi Wolt nie czyta, ale rysunki tak: mapa dojścia do drugiej lokacji.
- **2026-11-11** Przyjęte zakończenie: ploter w dyżurce drukuje rysunkową mapę do R-2, Wolt wyjeżdża przez bramę, karta „Scena 4 · Odjazd”.
- **2026-11-08** Każda decyzja i zmiana musi być w dokumentacji w repo (ten plik, DECYZJE.md, SWIAT.md, POCZATEK.md, [AGENTS.md](../AGENTS.md)), tak żeby inny agent albo człowiek mógł przejąć pracę.
- **2026-11-11** Otwarty świat nie ma skraju mapy: poza ubitym gruntem Wolt grzęźnie w sypkim popiele i buksuje, a ubita jest tylko droga. Nowe sceny mają robić to samo zamiast ściany na brzegu.

Kierunek artystyczny i dźwiękowy (wspólny dla całego projektu): nastrój jak w Inside (wyblakła mgła, sylwetki, kolor tylko dla ważnych rzeczy), wyblakła europejska i słowiańska przyroda (nie PRL, nie Ameryka), ambient jak w GrassChopper, wszystkie dźwięki własne i proceduralne.

## Sterowanie w grze

| Klawisz | Akcja |
|---|---|
| LPM na terenie | jedź tam (przytrzymaj: Wolt jedzie za kursorem) |
| LPM na rzeczy | podjedź i użyj (kursor zmienia się w rączkę nad rzeczą; przy dźwigni i transformatorze E trzyma się samo) |
| LPM obok notatki | odłóż notatkę |
| WASD / strzałki | jazda (przerywa jazdę myszą) |
| Shift | szybciej |
| E | użyj (krótko) albo przytrzymaj (naprawa, dźwignia) |
| Q | odczep oponę / połóż kabel |
| J | archiwum notatek, cyfry otwierają zapis |
| Esc / E / spacja | odłóż notatkę |

Mysz (`src/game/sim/clickWalk.ts` + `src/game/scenes/mouse.ts`) nie ma własnej ścieżki w logice scen: zamienia klik na ten sam kierunek i to samo E, które daje klawiatura (A* `findPath` do celu, hamowanie na znaczniku przez `stopIn` w `drive`). Sceny mają `usables()` (co teraz da się użyć, z pozycją) i `current()` (co E użyłoby teraz): Wolt staje, gdy kliknięta rzecz staje się tą, której E by użyło. Stuknięcie palcem na telefonie działa tak samo.
| M | dźwięk wł./wył. |
| spacja (przytrzymaj) | pomiń Scenę 0 |

## Jak dodać nową scenę

1. `src/game/sim/<scena>.ts`: klasa z `update(dt, input)`, `hint()`, `goal()`, `events` i stałymi na górze pliku.
2. `test/<scena>.test.ts`: przejście sceny przez A* (`findPath`) jak w `test/station.test.ts`.
3. `src/game/render/<scena>View.ts`: widok, który tylko czyta stan.
4. `src/game/scenes/<scena>.ts`: klej z HUD-em, dźwiękami i notatkami (`noteHtml`, `journalHtml`).
5. Wpis w `scenes` w `src/game/main.ts` i `next` w poprzedniej scenie.
6. Aktualizacja tego pliku (tabela scen, różnice względem POCZATEK.md) i README, jeśli zmienia się sterowanie.
