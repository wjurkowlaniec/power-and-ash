# Popiół i Prąd (power-and-ash)

Top-down gra survivalowa w przeglądarce. Automat serwisowy Wolt ciągnie kable przez pustynię popiołu,
żeby z lądowego jachtu Żaglowozu ponownie zasilić stare stacje przesyłowe.

**Gra:** https://wjurkowlaniec.github.io/power-and-ash/ (fabuła od początku, sceny z [docs/POCZATEK.md](docs/POCZATEK.md))

**Tech demo:** https://wjurkowlaniec.github.io/power-and-ash/demo/ (poziom „Rozruch”, poligon do testowania mechanik)

**Tech demo „Warsztat”:** https://wjurkowlaniec.github.io/power-and-ash/demo-craft/ (wytwarzanie, ekwipunek i wózek, rozbiórka, sieć, drzewko technologii, moduły Wolta, antena; 12 etapów po kolei, opis w [docs/DEMO-WARSZTAT.md](docs/DEMO-WARSZTAT.md))

Gra i demo są w jednym repo i dzielą kod silnika (`src/sim`, `src/render`, `src/audio`). Gra ma swoje wejście `index.html` → `src/game/main.ts`, demo `demo/index.html` → `src/main.ts`. W grze `?scene=hall` przeskakuje do wybranej sceny (do testów), a przytrzymana spacja pomija Scenę 0.

- [Plan implementacji i kamienie milowe](docs/PLAN.md)
- [Świat, fabuła i systemy](docs/SWIAT.md)
- [Początek gry scena po scenie](docs/POCZATEK.md)
- [Rejestr decyzji](docs/DECYZJE.md) (co Wojtek ustalił, kiedy i co odrzucono; każda nowa decyzja trafia tam i do dokumentu, którego dotyczy)
- [Ruch, animacja i ślady Wolta](docs/RUCH-I-ANIMACJA.md) (model jazdy, holowanie, animator, ślady i pył, wstawanie i bateria w hali)
- [Pomysły na później](docs/POMYSLY.md) (myśli Wojtka jeszcze nie do zrobienia)
- [Dokument projektowy](docs/design.html) (research gatunku, koncepcja, zasady kabli, wizualizacje)

## Sterowanie

| Klawisz | Akcja |
|---|---|
| LPM na terenie | idź tam (przytrzymaj: Wolt idzie za kursorem) |
| LPM na obiekcie | podejdź i użyj (złom, beczka, port, fabrykator, ster, Wolt = światło) |
| PPM na obiekcie | menu ze wszystkimi akcjami |
| WASD / strzałki | ruch (przerywa marsz myszą) |
| Shift | bieg |
| E | użyj: weź / wepnij / wypnij kabel, fabrykator, ster |
| E (przytrzymaj) | rozbierz złom albo beczkę |
| L | światło Wolta wł./wył. |
| kółko myszy, + / − | zoom |
| Q (przytrzymaj) | zwiń kabel |
| Alt | panel sieci |
| M | dźwięk wł./wył. |
| H | pomoc |

## Grafika i licencje

Modele są od [Quaterniusa](https://quaternius.com) i [Kaya Lousberga](https://www.kaylousberg.com), wszystkie na licencji CC0. Szczegóły w [CREDITS.md](CREDITS.md).

## Rozwój

```bash
npm install
npm run dev          # localhost
npm test             # testy logiki (Vitest)
npm run build        # dist/ pod GitHub Pages
npm run build:single # dist-single/index.html, jeden samodzielny plik
```

Struktura:

- `src/sim/` to logika gry w czystym TypeScripcie (siatka, kabel, sieć, stan gry, model jazdy `drive.ts`, holowanie `tow.ts`), bez Three.js.
- `src/render/` to scena Three.js, która czyta stan gry (wspólne: model i animator Wolta `wolt.ts`, ładunki `loads.ts`, ślady i pył `groundFx.ts`).
- `src/audio/` to proceduralny dźwięk w Web Audio.
- `test/` to testy logiki.

Pełny opis kodu, buildu i testów: [docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md) (repo, silnik, tech demo) i [docs/GRA.md](docs/GRA.md) (sceny gry).

## Deploy

Każdy push na `main` buduje i publikuje grę na GitHub Pages (`.github/workflows/pages.yml`: testy, build, kopia `docs/` pod `/docs/`). Każdy PR przechodzi CI (`.github/workflows/ci.yml`: testy i build). Zasada projektu: każda zmiana idzie przez PR, po zielonym CI jest squash-merge do `main` i od razu ląduje na Pages do testu. Jeśli strona pokazuje starą wersję, zrób Ctrl+Shift+R.

## Przejmowanie projektu

Zacznij od [AGENTS.md](AGENTS.md) (zasady pracy, także dla ludzi) i [docs/DECYZJE.md](docs/DECYZJE.md) (wszystkie decyzje Wojtka z datami i to, co czeka na decyzję). Każda decyzja i każda zmiana trafia do dokumentacji w tym samym PR.
