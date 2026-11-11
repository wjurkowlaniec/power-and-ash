# Popiół i Prąd (power-and-ash)

Top-down gra survivalowa w przeglądarce. Automat serwisowy Wolt ciągnie kable przez pustynię popiołu,
żeby z lądowego jachtu Żaglowozu ponownie zasilić stare stacje przesyłowe.

**Gra:** https://wjurkowlaniec.github.io/power-and-ash/ (fabuła od początku, sceny z [docs/POCZATEK.md](docs/POCZATEK.md))

**Tech demo:** https://wjurkowlaniec.github.io/power-and-ash/demo/ (poziom „Rozruch”, poligon do testowania mechanik)

**Tech demo „Żegluga”:** https://wjurkowlaniec.github.io/power-and-ash/demo-sail/ (jazda Żaglowozem po różnym terenie: szkwały, cień wiatru za domami, przechył, koła i płozy, trasy na czas, rysowane intro o wietrze; opis w [docs/DEMO-ZEGLUGA.md](docs/DEMO-ZEGLUGA.md))

**Tech demo „Słońce”:** https://wjurkowlaniec.github.io/power-and-ash/demo-sun/ (przewóz ładunku, który musi być oświetlony: cienie chmur, zapas 20 s, misje A → B; opis w [docs/DEMO-SLONCE.md](docs/DEMO-SLONCE.md))

**Tech demo „Powroty”:** https://wjurkowlaniec.github.io/power-and-ash/demo-returns/ (jedna osada przez lata, bez słów: światło w oknie, sen na lata, symbol na ścianie, jedna tajemnica; opis w [docs/DEMO-POWROTY.md](docs/DEMO-POWROTY.md))

**Tech demo „Warsztat”:** https://wjurkowlaniec.github.io/power-and-ash/demo-craft/ (wytwarzanie, ekwipunek i wózek, rozbiórka, sieć, drzewko technologii, moduły Wolta, antena; budowa i żegluga Żaglowozu; 14 etapów po kolei, opis w [docs/DEMO-WARSZTAT.md](docs/DEMO-WARSZTAT.md))

Gra i demo są w jednym repo i dzielą kod silnika (`src/sim`, `src/render`, `src/audio`). Gra ma swoje wejście `index.html` → `src/game/main.ts`, demo `demo/index.html` → `src/main.ts`. W grze `?scene=hall` przeskakuje do wybranej sceny (do testów), a przytrzymana spacja pomija Scenę 0.

- [Plan implementacji i kamienie milowe](docs/PLAN.md)
- [Świat, fabuła i systemy](docs/SWIAT.md)
- [Przepływ fabuły i drzewko decyzji](docs/FABULA.md) (nieliniowo, z wyborami, do 100%) i [mapa świata](docs/mapa-swiata.html)
- [Symulacja czasu gracza i pokoleń ludzi](docs/SYMULACJA.md) ([interaktywnie](docs/symulacja.html))
- [Początek gry scena po scenie](docs/POCZATEK.md)
- [Rejestr decyzji](docs/DECYZJE.md) (co Wojtek ustalił, kiedy i co odrzucono; każda nowa decyzja trafia tam i do dokumentu, którego dotyczy)
- [Ruch, animacja i ślady Wolta](docs/RUCH-I-ANIMACJA.md) (model jazdy, holowanie, animator, ślady i pył, wstawanie i bateria w hali)
- [Pomysły na później](docs/POMYSLY.md) (myśli Wojtka jeszcze nie do zrobienia)
- [Jak testować i zgłaszać błędy oraz pomysły](#jak-testować) (dla testerów)
- [Dokument projektowy](docs/design.html) (research gatunku, koncepcja, zasady kabli, wizualizacje)

## Jak testować

Wszystko działa w przeglądarce, bez instalowania. Najlepiej Chrome albo Firefox na komputerze, z dźwiękiem. Po każdej zmianie strona aktualizuje się sama w kilka minut; jeśli coś wygląda na starą wersję, odśwież z Ctrl+Shift+R (Mac: Cmd+Shift+R).

### Co jest do przetestowania

| Wersja | Link | Co to jest |
|---|---|---|
| **Gra** | https://wjurkowlaniec.github.io/power-and-ash/ | Prawdziwa gra. Startuje od menu: nowa gra (ciemność, hala, martwa stacja), wybór sceny albo przejście do tech demo. W grze **Esc** otwiera menu (pauza, restart sceny, inna scena). Przytrzymana spacja pomija pierwszą scenę. |
| Gra od hali | https://wjurkowlaniec.github.io/power-and-ash/?scene=hall | Skok do Sceny 1 (Wolt budzi się w hali), bez menu. |
| Gra od stacji | https://wjurkowlaniec.github.io/power-and-ash/?scene=station | Skok do Sceny 2 (martwa stacja, turbina, kabel do maszynowni), bez menu. |
| **Tech demo „Rozruch”** | https://wjurkowlaniec.github.io/power-and-ash/demo/ | Poligon mechanik: kable, złom, fabrykator, ładowanie Żaglowozu, odjazd. |
| **Tech demo „Warsztat”** | https://wjurkowlaniec.github.io/power-and-ash/demo-craft/ | Wytwarzanie, ekwipunek, wózek, rozbiórka, sieć, drzewko technologii. 12 etapów, `?stage=0` … `?stage=11` otwiera wybrany. |
| **Tech demo „Żegluga”** | https://wjurkowlaniec.github.io/power-and-ash/demo-sail/ | Jazda Żaglowozem: wiatr ze szkwałami i cieniem za domami, różne podłoża, przechył, trasy na czas, intro. Wolt jest przednim kołem (E silnik, Shift balast), z bliska widać całe olinowanie. Pierwsze uruchomienie zaczyna się szkoleniem w symulatorze Q-1 z egzaminem pod wiatr (`?train`, `?go` pomija). `?course=lake` (village, dunes, forest) zaczyna na trasie. |
| **Tech demo „Słońce”** | https://wjurkowlaniec.github.io/power-and-ash/demo-sun/ | Przewóz ładunku na panelach słonecznych: cienie chmur płyną z wiatrem, w cieniu ładunek ma zapas ok. 20 s, trzeba trzymać się jasnych plam od A do B. Trzy misje, `?mission=samples` (seedlings, culture) wybiera misję. |
| **Tech demo „Powroty”** | https://wjurkowlaniec.github.io/power-and-ash/demo-returns/ | Jedna osada przez lata, bez napisów w świecie. Podepnij kabel przy ostatnim słupie (E), śpij przy zimowisku (przytrzymaj E), wróć do domu i patrz, co się zmieniło. Do oceny: czy znaki da się odczytać bez podpowiedzi. |
| Wersja angielska | dopisz `?lang=en` do linku (np. https://wjurkowlaniec.github.io/power-and-ash/demo/?lang=en) | Ta sama gra po angielsku, przydatne do sprawdzania tłumaczeń. |
| Dokument projektowy | https://wjurkowlaniec.github.io/power-and-ash/docs/design.html | Koncepcja i wizualizacje, do czytania. |

Sterowanie jest niżej w sekcji [Sterowanie](#sterowanie), a w grze pod klawiszem H.

### Gdzie zgłaszać

Wszystko trafia do [GitHub Issues](https://github.com/wjurkowlaniec/power-and-ash/issues). Potrzebne jest konto na GitHubie; Wojtek dodaje testerów jako współpracowników repo (Settings → Collaborators), wtedy dostają też powiadomienia o odpowiedziach.

1. Wejdź na [New issue](https://github.com/wjurkowlaniec/power-and-ash/issues/new/choose).
2. Wybierz formularz:
   - **Błąd** (etykieta `bug`): coś nie działa, zacina się, wygląda źle albo jest niezrozumiałe. Formularz pyta o link z paska adresu, kroki, co się stało i zrzut ekranu.
   - **Pomysł** (etykieta `pomysł`): pomysł albo zwykłe wrażenie z gry („tu się nudziłam”, „nie wiedziałam, co dalej”). Nie musi być dopracowany.
3. Jedno zgłoszenie = jedna sprawa. Zrzuty ekranu i krótkie nagrania przeciąga się prosto do pola tekstowego.

Co dalej: agent (Claude) i Wojtek czytają zgłoszenia, błędy naprawiają w PR z dopiskiem `Fixes #numer` (zgłoszenie zamyka się samo, gdy poprawka jest na Pages), a pomysły po decyzji Wojtka trafiają do [docs/POMYSLY.md](docs/POMYSLY.md) albo do planu. Etykieta `do-decyzji` znaczy, że sprawa czeka na Wojtka.

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
| Esc (gra) | menu: wróć, zacznij scenę od nowa, inna scena, tech demo (gdy otwarta jest notatka, Esc najpierw ją zamyka) |

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
