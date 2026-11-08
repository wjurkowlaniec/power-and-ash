# Ruch, animacja i ślady Wolta

Jak porusza się i wygląda w ruchu Wolt-monocykl. Kod jest wspólny dla gry i tech demo. Ten dokument opisuje, jak to działa, dlaczego tak, i gdzie stroić wartości.

## Decyzje (z feedbacku Wojtka, 2026-11-08)

- Animacje mają być **płynne, bez skoków**. Dotyczy to zwłaszcza zacinającej się opony, startu gry (wstawanie z kołyski) i brania baterii. Prostota w stylu Little Big Adventure to za mało, ma wyglądać ładnie.
- Robot ma być **precyzyjny**: bez ślizgania się bokiem i bez korpusu, który obraca się z opóźnieniem względem ruchu. Ma się zatrzymywać tam, gdzie kazano.
- **Buksowanie w miejscu** ma być widać: kiedy zaczepiona opona albo kabel trzyma Wolta, koło się kręci, a spod niego leci popiół.
- **Ślady** zależą od podłoża. Wolt zostawia inne ślady niż ciągnięta opona. Żadnych prostokątów.
- Klimat jak w Inside: stonowany, kolory przyszarzone. Pył i ślady mają być subtelne, nie efekciarskie.
- Ładowanie odbywa się zawsze przez fizyczny styk (bolec na ramieniu albo mikrokabel 3 m), nigdy indukcyjnie. Szczegóły są w [SWIAT.md](SWIAT.md), sekcja „Ładowanie”. Przyszłe animacje wpinania muszą to pokazywać.

## Model ruchu: `src/sim/drive.ts`

Czysta logika, bez Three.js. Używają jej `src/sim/game.ts` (demo), `src/game/sim/hall.ts` i `src/game/sim/station.ts`.

- Ciało ma `facing` (kurs, 0 = +x) i `speed` (m/s wzdłuż kursu). Wolt toczy się **tylko wzdłuż kursu**, nigdy bokiem.
- `drive(state, dt, dir, max, spec, stopIn)` obraca kurs w stronę `dir` z ograniczoną prędkością kątową. Prędkość docelowa to `max · cos²(pozostały kąt)`, więc ostry skręt zamienia się w obrót w miejscu, a nie w poślizg. Przyspieszanie i hamowanie są ograniczone (`accel`, `brake`). `stopIn` hamuje tak, żeby stanąć dokładnie na celu kliknięcia.
- `settle(state, moved, dt)` po kolizjach obcina prędkość do tego, co faktycznie przejechał. Po ścianie albo napiętej linie rusza więc znowu łagodnie.
- `turnTowards` obraca w miejscu, na przykład przy rozbieraniu złomu albo przy komorze baterii.
- Strojenie: `WOLT_DRIVE = { accel: 10, brake: 16, turn: 10 }`. Na rezerwie w hali działa `RESERVE_DRIVE` (wolniej rusza i skręca). Falowanie mocy na rezerwie to łagodny sinus prędkości maksymalnej, a nie szarpanie pozycją.
- Symulacja ustawia `strain = true`, gdy gracz jedzie, a Wolt przejechał mniej niż 35% zamierzonej drogi. Wtedy koło buksuje.

Widoki (`src/render/view.ts`, `src/game/render/hallView.ts`, `stationView.ts`) biorą kąt obrotu wprost z symulacji (`rotation.y = π/2 − facing`), bez wygładzania. Wygładza już symulacja, więc nie ma opóźnienia ani ślizgu. Prędkość dla animatora jest **ze znakiem** (rzut przesunięcia na kurs), dzięki czemu jazda tyłem kręci koło do tyłu.

## Holowanie: `src/sim/tow.ts`

- `towStep` przesuwa ładunek za hakiem. Lina tylko ciągnie, a ładunek ślizga się po ścianach osobno w osiach.
- `towDrive` obsługuje zaczepienie: ładunek przesuwa się, jak daleko się da, a Wolt jest trzymany na obecnej długości liny wokół niego. Jadąc prosto od przeszkody zwalnia do zera i buksuje. Jadąc w bok objeżdża ją po okręgu. Jadąc w stronę ładunku jedzie zawsze. Wcześniej Wolt zamierał w miejscu i skakał po odczepieniu.

## Animator: `src/render/wolt.ts`

`WoltAnimator.update(frame)` steruje balansem (przechył na sprężynach), kołem, bębnem, prowadnicą kabla, ramieniem i lampą.

- `slip` (0..1) narasta i opada płynnie, gdy `strain` się włącza i wyłącza. Koło kręci się wtedy dodatkowo z prędkością do 16 rad/s, a kapsuła drży (gładki szum, nie piła).
- `kick(pitch, roll)` daje impuls sprężynom balansu: lądowanie po zjeździe z kołyski, stuknięcie wkładanej baterii.
- Pozy ramienia: `rest`, `work`, `reach`, `back`, `stow` (chwytak nad kapsułą, do wkładania). Ramię przechodzi między nimi płynnie. `arm.wrist` jest wystawiony, żeby trzymane przedmioty mogły za nim podążać.

## Ładunki: `src/render/loads.ts`

- `loadModel` zwraca `group` (pozycja i obrót) oraz `body` (przechyły). Rzeczy leżące na ładunku (łożysko na oponie) dodawaj do `body`.
- `animateDragged` płynnie unosi przód ciągniętego ładunku (o tylną krawędź) i dodaje drżenie z gładkiego szumu.
- `ropeGeometry` rysuje linę prosto, gdy jest napięta, i z ciągłym zwisem, gdy ma luz.

## Ślady i pył: `src/render/groundFx.ts`

Klasa `GroundFx` należy do sceny. Każdy widok co klatkę woła `wheel(...)` dla Wolta, `drag(key, ...)` dla każdego ładunku, `setScale(pxPerMetre(renderer, camera))` i `update(dt)`.

- **Ślady to ciągłe wstęgi** (`Ribbon`, bufor kołowy segmentów), a nie stemplowane prostokąty. Koło zostawia wąski (8,5 cm), żebrowany bieżnik. Opona zostawia szeroką smugę z ciemniejszymi prążkami tam, gdzie trze obręcz. Linie zaczynają się i kończą wygaszeniem. Ślady blakną z czasem (`life` podłoża).
- **Podłoże** to funkcja `(x, z) → Surface`, którą podaje widok. Gotowe typy w `SURFACES`: `ash` (głębokie ślady, dużo pyłu), `dustyConcrete` (słabe ślady w kurzu), `concrete`, `water` (kałuża; koło przez kolejne 5 m zostawia ciemne, mokre ślady). Demo: wszędzie popiół. Hala: zakurzony beton i kałuża. Stacja: popiół na podwórzu, zakurzony beton pod dachem (z wysokością płyty `y`).
- **Pył** to pula 480 cząstek (`Points` z własnym shaderem, rozmiar w metrach). Wyrzut zależy od buksowania (silny strumień do tyłu i w górę), mocnego ruszania i hamowania, obrotu w miejscu i biegu. Ciągnięty ładunek zgarnia trochę popiołu przed sobą. Pod buksującym kołem rośnie ciemne wgłębienie.

## Hala: wstawanie i bateria (`src/game/render/hallView.ts`)

- **Wstawanie** (`WAKE_TIME = 3 s`): oczy zapalają się z miękkim migotaniem, korpus prostuje się w kołysce (lekko za pion), zjeżdża tyłem z krawędzi i ląduje z impulsem `kick`. Wszystkie nakładki na balans są addytywne i dochodzą do zera, więc nie ma przeskoku po przejęciu przez animator.
- **Bateria** (`INSERT_TIME = 3,6 s`, faza `u = insertT / INSERT_TIME`): Wolt obraca się do komory i podjeżdża 0,3 m (symulacja). Teleskopowy pręt ramienia komory wysuwa ogniwo przez otwarty front (`u` 0,04–0,38). Chwytak je przejmuje (0,40–0,52). Ogniwo zostaje przeniesione nad kapsułę i zmniejsza się do rozmiaru kasety (0,5–0,8), po czym wsuwa się w korpus (0,74–0,97). Okienko ogniwa rozjaśnia się płynnie.
- Migotania (oczy, poświata, licznik rezerwy) to gładki szum z rzadkimi przygaśnięciami, a nie nowy `Math.random()` co klatkę.

## Przejścia między scenami (`src/game/main.ts`)

Kiedy scena ustawia `next`, jeszcze przez 0,8 s działa pod wygaszeniem do czerni (`FADE_OUT`) i dopiero wtedy przełącza się na następną. Nowa scena robi własne rozjaśnienie.

## Testy i podgląd

- Logika ruchu jest pokryta przez `test/level1.test.ts`, `test/tow.test.ts`, `test/hall.test.ts` i `test/station.test.ts`. Pomocnik `walkTo` w teście hali uwzględnia obrót w miejscu, więc nie traktuje go jako zablokowania.
- Zrzuty w headless Chromium: zbuduj `npm run build`, skopiuj `dist/` do katalogu `www/power-and-ash` i serwuj przez `python3 -m http.server`. Swiftshader daje około 4 kl./s, więc do deterministycznych ujęć wołaj w stronie `game.update` i `view.frame` w pętli z `dt = 1/60`, z wyłączonym `renderer.render` na czas symulacji.
