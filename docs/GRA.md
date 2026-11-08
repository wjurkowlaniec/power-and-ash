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
| `scene.ts` | interfejsy `Scene` (`enter` / `update` / `exit` / `next`) i `Ctx` (fx, dźwięk, modele, HUD, wejście) |
| `state.ts` | to, co przechodzi między scenami w jednym przejściu gry (np. naładowanie baterii) |
| `sim/*.ts` | **czysta logika** sceny, bez Three.js, z testami w `test/` (`Hall`, `Station`) |
| `render/*View.ts` | scena 3D: czyta stan logiki co klatkę i nic w nim nie zmienia |
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
| 2. Martwa stacja | `station` | działa część 1–2 (niżej); suwnica i maszynownia od środka to `crane` (karta „w budowie”) |
| 3–8 | | jeszcze nie ma |

### Scena 2 w obecnej wersji

1. Port na lewo od drzwi warsztatu: E wpina kabel własny Wolta (3 m), zamek puszcza, kosztuje to 6% baterii.
2. Fabrykator odmawia: potrzebuje 600 W, a Wolt daje 200 W.
3. Opona z podwórza jak sanie (E doczepia, **Q zawsze odczepia**). W magazynie, na drugiej półce, leżą smar i łożysko. Łożysko trafia na oponę.
4. Z łożyskiem pod masztem: przytrzymać E, turbina rusza.
5. Pod masztem stoi bęben z **18 m kabla**. E bierze koniec, kabel owija się o przeszkody, Q odkłada, E podnosi. Koniec kabla trafia do przyłącza na ścianie maszynowni od strony podwórza. Maszynownia budzi się (światło, lampka), a dopiero potem scena się kończy.
6. Bilans Q-1 w %/s i panel „Sieć stacji” (turbina, Wolt, maszynownia, fabrykator).
7. Notatki: kartka technika (pismo odręczne, dwa rysunki), pismo kierowniczki w szufladzie, mapa sieci, dwie książki na półce w dyżurce.

**Różnice względem POCZATEK.md** (do uzgodnienia lub do dorobienia):

- Smar i łożysko leżą gotowe na półce. Nie ma jeszcze rozbiórki złomu ani wspinaczki po drabince.
- Zamiast szpuli 12 m przez okno dyżurki jest bęben 18 m pod masztem, a przyłącze maszynowni jest od strony podwórza. To odpowiedź na uwagę Wojtka, że poziom urywał się po turbinie.
- Suwnicy, zapalania świateł w całej stacji i działającego fabrykatora jeszcze nie ma (`crane`).

## Decyzje Wojtka dotyczące gry

Pełne sformułowania i kontekst są w wątkach projektu, a tutaj są ich skróty z datą.

- **2026-11-06** Prototyp zostaje jako **tech demo** do testowania mechanik. Prawdziwa gra powstaje równolegle według POCZATEK.md i dzieli silnik.
- **2026-11-06** Każda zmiana trafia od razu na GitHub Pages do testów: PR, zielone CI, squash-merge, deploy.
- **2026-11-06** Scena 0 ma być krótka (20 s, kropka po ok. 2,5 s). Na rezerwie Wolt jedzie wolno, ale równo, a nie coraz wolniej.
- **2026-11-06** Dźwignia musi być zrozumiała: rura połyskuje po pierwszej próbie, a podpowiedź niesie notatka (teraz: rysunek).
- **2026-11-06** Bateria Q-1 zostaje kwantowa. Historia i wskazówki płyną z notatek znajdowanych w świecie, jak w Control.
- **2026-11-07** Wolt w grze to wspólny monocykl z dema: ramię, kabel z bębna wpływa na przechył, obrót tylko w kierunku jazdy, skrzypienie koła zamiast kroków.
- **2026-11-07** Nie może być martwych punktów: hol zawsze da się odczepić (Q), opona nie może zablokować ruchu, a na postoju Q-1 powoli odzyskuje energię (0,15%/s, widoczne w panelu). Cel ma być czytelny: cicha linijka celu i podpowiedzi mówiące, czego brakuje.
- **2026-11-07** Budynki mają dachy. Kiedy dach albo ściana zasłania Wolta, znika tylko miękkie koło wokół niego, jak w Control Resonant (shader `holeMat` w `stationView.ts`).
- **2026-11-07** Poziom nie powinien kończyć się na turbinie: prąd trzeba jeszcze doprowadzić kablem do maszynowni. Uwagi Wojtka to obserwacje, a nie ścisła specyfikacja.
- **2026-11-08** Q-1 nie rozumie ludzkiego pisma. Notatki są na start nieczytelne, a korpus odkodowuje je progami: liczby i ostrzeżenia (450 znaków), druk techniczny (1400), zwykły druk (3500), pismo odręczne (7000). Wczesne wskazówki niosą rysunki. Szczegóły są w SWIAT.md, sekcja „Notatki i archiwum”.
- **2026-11-08** Kabel nie może znikać pod podłogą (`cableTube`).
- **2026-11-08** Gra i demo mają wersję angielską (przełącznik PL · EN na ekranie startowym). Bateria pokazuje bilans prądu, a jazda jest płynna (wspólne `drive.ts`).
- **2026-11-08** Każda decyzja i zmiana musi być w dokumentacji w repo (ten plik, SWIAT.md, POCZATEK.md, [CLAUDE.md](../CLAUDE.md)), tak żeby inny agent albo człowiek mógł przejąć pracę.

Kierunek artystyczny i dźwiękowy (wspólny dla całego projektu): nastrój jak w Inside (wyblakła mgła, sylwetki, kolor tylko dla ważnych rzeczy), wyblakła europejska i słowiańska przyroda (nie PRL, nie Ameryka), ambient jak w GrassChopper, wszystkie dźwięki własne i proceduralne.

## Sterowanie w grze

| Klawisz | Akcja |
|---|---|
| WASD / strzałki | jazda |
| Shift | szybciej |
| E | użyj (krótko) albo przytrzymaj (naprawa, dźwignia) |
| Q | odczep oponę / połóż kabel |
| J | archiwum notatek, cyfry otwierają zapis |
| Esc / E / spacja | odłóż notatkę |
| M | dźwięk wł./wył. |
| spacja (przytrzymaj) | pomiń Scenę 0 |

## Jak dodać nową scenę

1. `src/game/sim/<scena>.ts`: klasa z `update(dt, input)`, `hint()`, `goal()`, `events` i stałymi na górze pliku.
2. `test/<scena>.test.ts`: przejście sceny przez A* (`findPath`) jak w `test/station.test.ts`.
3. `src/game/render/<scena>View.ts`: widok, który tylko czyta stan.
4. `src/game/scenes/<scena>.ts`: klej z HUD-em, dźwiękami i notatkami (`noteHtml`, `journalHtml`).
5. Wpis w `scenes` w `src/game/main.ts` i `next` w poprzedniej scenie.
6. Aktualizacja tego pliku (tabela scen, różnice względem POCZATEK.md) i README, jeśli zmienia się sterowanie.
