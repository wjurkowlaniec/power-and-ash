# Architektura: repo, silnik, tech demo, build i deploy

Ten dokument opisuje całe repo z lotu ptaka: jak jest podzielony kod, co jest wspólnym silnikiem, jak działa tech demo, jak przebiega build, testy i deploy na GitHub Pages. Kod **gry** (`src/game/`, sceny z POCZATEK.md) opisuje szczegółowo [GRA.md](GRA.md), a ruch i animację Wolta [RUCH-I-ANIMACJA.md](RUCH-I-ANIMACJA.md). Decyzje, które za tym stoją, są w [DECYZJE.md](DECYZJE.md).

Każdy PR, który zmienia strukturę kodu, build albo deploy, aktualizuje ten plik.

## Stack i powody

| Wybór | Dlaczego |
|---|---|
| **Przeglądarka** | Wojtek chce grać i testować w przeglądarce, bez instalacji (2026-11-06). |
| **Three.js 0.169 + TypeScript 5.6 + Vite 5** | „2D na scenie 3D”: kamera ortograficzna pochylona nad płaską siatką kafli daje za darmo światło, cienie, mgłę i lampę. Czysty kod bez edytora sceny, statyczne pliki na Pages. Godot 4 był rozważany i odrzucony (ciężki eksport web, wolniejsza iteracja). |
| **Widok z góry jak w Factorio** | decyzja Wojtka po pierwszej makiecie z boku (2026-11-06). 1 kafel = 1 m. |
| **Vitest** | testy czystej logiki w Node, bez przeglądarki. |
| **Dźwięk proceduralny (Web Audio)** | własne dźwięki bez plików, nastrój w duchu GrassChopper. |
| **Modele CC0** (Quaternius, KayKit) | szybki lepszy wygląd, licencja bez ograniczeń, zob. [CREDITS.md](../CREDITS.md). |

## Mapa repo

```
index.html              wejście gry           → src/game/main.ts
demo/index.html         wejście tech demo     → src/main.ts
demo-craft/index.html   wejście demo „Warsztat” → src/craft/main.ts
demo-sail/index.html    wejście demo „Żegluga” → src/sail/main.ts
vite.config.ts          build wielostronicowy (gra + demo) i tryb single-file
src/
  sim/                  WSPÓLNA logika w czystym TS (bez Three.js)
  render/               WSPÓLNY render Three.js (+ widok tech demo view.ts)
  audio/ambient.ts      dźwięk tech demo (Web Audio)
  i18n.ts               PL/EN: tr('polski', 'English')
  main.ts, demoText.ts, style.css   tech demo
  game/                 GRA (sceny z POCZATEK.md), opis w docs/GRA.md
  craft/                demo „Warsztat” (wytwarzanie, technologie, moduły), opis w docs/DEMO-WARSZTAT.md
  assets/craft/         modele KayKit tylko dla „Warsztatu”
  sail/                 demo „Żegluga” (jazda Żaglowozem: teren, pole wiatru, fizyka, trasy, intro), opis w docs/DEMO-ZEGLUGA.md
  assets/models/        skompresowane modele GLB (CC0)
test/                   testy Vitest (logika)
tools/pack-models.mjs   konwersja paczek CC0 do src/assets/models
tools/pack-craft-models.mjs  paczki KayKit (z GitHuba) do src/assets/craft
docs/                   dokumentacja (ten katalog), kopiowana też na Pages pod /docs/
.github/workflows/      CI (PR) i deploy na Pages (main)
```

## Zasada nadrzędna: logika osobno od widoku

- **Logika** (`src/sim/`, `src/game/sim/`) to czysty TypeScript. Nie importuje Three.js ani DOM. Trzyma stan i reguły, a co klatkę dostaje `update(dt, input)`. Dzięki temu jest w pełni testowalna w `test/` i niezależna od silnika graficznego.
- **Widok** (`src/render/`, `src/game/render/`) co klatkę czyta stan logiki i rysuje. Niczego w nim nie zmienia.
- **Dźwięk** czyta stan albo zdarzenia logiki (np. `events: string[]` w scenach gry).
- Jedyny wyjątek od „logika bez zależności”: `src/sim/*` importuje `tr()` z `src/i18n.ts`, bo podpowiedzi i nazwy dla gracza powstają w logice. `i18n.ts` działa też poza przeglądarką (w testach zawsze po polsku).

## Wspólny silnik

Używają go i gra, i tech demo. Zmiana tutaj musi zostawić obie strony działające, a testy obu muszą przechodzić.

### `src/sim/` (logika)

| Plik | Co robi |
|---|---|
| `vec.ts` | wektory 2D na płaszczyźnie gruntu (`y` w logice = oś Z w renderze), przecięcia odcinków, trójkąty |
| `world.ts` | siatka kafli i przeszkody (prostokąty w kaflach): skały, złom z łupem i nazwą do karty, kontenery, drzewa, żaglowóz, stacja; kolizje okręgu z siatką; narożniki do owijania kabla |
| `cable.ts` | kabel jak napięty sznurek: zagina się na wypukłych narożnikach przeszkód, gdy koniec się przesuwa, i prostuje, gdy wraca. Długość liczona wzdłuż zagięć |
| `path.ts` | A* po kaflach dla marszu myszą, `clearLine` do wygładzania ścieżki |
| `drive.ts` | model jazdy monocykla: toczy się tylko wzdłuż kursu, skręca z ograniczoną prędkością (ostry skręt = obrót w miejscu), płynnie przyspiesza i hamuje, zatrzymuje się na celu |
| `footprint.ts` | obrys Wolta do kolizji: koło plus nos i szpula jako okręgi wzdłuż kursu; `bodyOk` (ruch), `guardTurn` (obrót w miejscu przy ścianie odsuwa koło albo cofa obrót). Używają go hala, stacja i demo |
| `tow.ts` | holowanie: opona i sanki z cegłami na linie 1,5 m za hakiem, zaczepianie o przeszkody, koszt energii i spowolnienie |
| `power.ts` | sieć energetyczna: węzły z portami, kable jako krawędzie, bilans mocy w każdej spójnej składowej |
| `wind.ts` | deterministyczny wiatr: kierunek i siła z sumy wolnych sinusów, podmuchy |
| `game.ts`, `level.ts` | **tylko tech demo**: stan poziomu „Rozruch” i jego definicja (zob. niżej) |

### `src/render/` (Three.js)

| Plik | Co robi |
|---|---|
| `palette.ts` | paleta w duchu Inside: popiół, mgła, ciemne sylwetki; kolor tylko dla ważnych rzeczy (lampa, napięty kabel, przekaźnik) |
| `assets.ts` | ładowanie modeli CC0 i „wyblakanie” ich materiałów w stronę popiołu; `fit`, `place` |
| `models.ts` | proceduralne modele (żaglowóz, stacja, przeszkody), pomocnicze `mat`, `mesh`, `box` |
| `wolt.ts` | Wolt-monocykl (etap „Rdzeń”): koło, kapsuła z Q-1, lampa, bęben kabla, ramię dwuprzegubowe, hak; `WoltAnimator` (balans, przechył, ramię, rozglądanie się) |
| `loads.ts` | modele holowanych ładunków i liny |
| `groundFx.ts` | ślady koła i opony zależne od podłoża, pył przy buksowaniu |
| `deck.ts` | pokład żaglowozu: stalowa rama z dwuteowników, europalety |
| `sail.ts`, `sailTexture.ts` | żagiel falujący w shaderze za wiatrem i wypłowiała reklama wymyślonej oranżady „Zefir”; opcjonalnie własna tekstura i `sheet` (szot ogranicza bom), z czego korzysta Żaglowóz w „Warsztacie” |
| `view.ts` | **tylko tech demo**: cała scena 3D poziomu „Rozruch” |

### Pozostałe wspólne

- `src/i18n.ts`: każdy tekst dla gracza to `tr('polski', 'English')` w miejscu użycia. Język: `?lang=en|pl`, potem zapisany wybór (`localStorage`), potem język przeglądarki. Przełączenie zapisuje wybór i przeładowuje stronę. Polski jest oryginałem.
- `src/audio/ambient.ts` to dźwięk tech demo. Gra ma własny `src/game/audio/sound.ts`.

## Tech demo („Rozruch”)

Stały poligon do testowania mechanik i technologii (decyzja Wojtka 2026-11-06). Nowa mechanika zwykle powstaje najpierw tutaj, a potem trafia do gry przez wspólny silnik.

- `demo/index.html`: statyczny HUD (polski), `src/demoText.ts` podmienia go na angielski.
- `src/main.ts`: ładuje modele, tworzy `Game(level1())`, `View` i `Sound`, obsługuje klawiaturę i mysz (klik = idź/użyj, przytrzymanie = idź za kursorem, PPM = menu akcji), HUD, karty po najechaniu myszą, panel sieci (Alt), zoom.
- `src/sim/level.ts`: definicja poziomu (mapa, przeszkody, złom z łupem i opisami, porty, fabrykator, ster, ładunki do holowania).
- `src/sim/game.ts`: `Game` trzyma cały stan: pozycję i energię Wolta, kable (bęben 60 m, odcinek maks. 20 m), sieć (`solveNetworks`), baterię żaglowozu, surowce, rozkazy myszy, cele i podpowiedzi, bilans energii linia po linii (`flows`). `update(dt, input)` raz na klatkę.
- `src/render/view.ts`: scena Three.js, `pickTarget` / `pick` do myszy, `frame(dt, aim)`.
- Zasady kabla, przebieg poziomu i bilans baterii są w [PLAN.md](PLAN.md).
- Do debugowania w konsoli: `window.game`, `window.view`.

## Tech demo „Warsztat” (`/demo-craft/`)

Drugi poligon (decyzja Wojtka 2026-11-08): wytwarzanie, ekwipunek z wózkiem, rozbiórka z narzędziami, sieć z rozgałęźnikami i magazynami, drzewko technologii, moduły Wolta, antena, budowa Żaglowozu na wózku i żegluga (`sim/sailing.ts`). 14 etapów do przeklikania. Cały kod w `src/craft/` (dane w `data.ts`, logika w `sim/`, widok w `render/`), opis, sterowanie i jak dodawać rzeczy: [DEMO-WARSZTAT.md](DEMO-WARSZTAT.md).

Korzysta ze wspólnego silnika (`World`, `Cable`, `solveNetworks`, `findPath`, `drive`, `towDrive`, `Wind`, model i animator Wolta, `GroundFx`, `Sound`). Dodał do niego tylko drobiazgi: `World.add()` (przeszkoda postawiona w trakcie gry), ładunek `'cart'` w `tow.ts`, eksport `fade` z `render/assets.ts`.

## Tech demo „Żegluga” (`/demo-sail/`)

Trzeci poligon (decyzja Wojtka 2026-11-10): jazda Żaglowozem jako rdzeń rozgrywki. Logika w `src/sail/sim/` (teren z polami podłoży, pole wiatru ze szkwałami i cieniem przeszkód, fizyka żaglowozu z przechyłem i poślizgiem, trasy na czas), widok w `src/sail/render/`, intro rysowane na płótnie 2D w `src/sail/intro.ts`. Opis, sterowanie i fizyka: [DEMO-ZEGLUGA.md](DEMO-ZEGLUGA.md).

Korzysta ze wspólnego silnika (`Sail`, model i animator Wolta, `GroundFx`, `Sound`) i z części „Warsztatu” (maszt, płozy, żagiel z balonu, wózek). Zmiany poza `src/sail/` (zgodne wstecz): opcjonalny filtr `only` w `loadCraftModels` i parametr `runnerRig(front = true)` w `src/craft/render/yachtModels.ts`. Od 2026-11-11 Wolt jest przednim kołem Żaglowozu (silnik z baterią, przesuwny balast), a olinowanie rysuje `src/sail/render/rope.ts`.

## Gra

Sceny z [POCZATEK.md](POCZATEK.md): `src/game/main.ts` (mapa scen, pętla, wygaszanie między scenami, menu główne na ekranie startowym i pauza pod Esc), `menu.ts` (lista scen i tech demo w menu, teksty przez `tr`; nowa scena = nowy wpis w `CHAPTERS`, scena może zgłosić `modal()`, żeby Esc najpierw zamykało jej notatkę), `scene.ts` (interfejs `Scene`), `scenes/*` (klej), `sim/*` (logika scen), `render/*View.ts` (widoki), `notes.ts` (notatki i odkodowanie), `fx.ts`, `audio/sound.ts`. Pełny opis i stan scen: [GRA.md](GRA.md). `?scene=<id>` przeskakuje do sceny z pominięciem menu (`darkness`, `hall`, `station`, `crane`), a w konsoli jest `window.hall` / `window.station`.

## Testy

`npm test` (Vitest, `test/**/*.test.ts`, środowisko Node):

| Plik | Co sprawdza |
|---|---|
| `cable.test.ts` | owijanie i odwijanie kabla, długość wzdłuż zagięć |
| `tow.test.ts` | holowanie, zaczepianie, lina |
| `level1.test.ts` | tech demo: przejście całego poziomu „Rozruch” w symulacji, bateria Wolta, mysz, obrót |
| `hall.test.ts`, `station.test.ts` | logika scen gry (hala, martwa stacja) |
| `notes.test.ts` | notatki, korpus, progi odkodowania |
| `craft.test.ts` | demo „Warsztat”: ekwipunek, rozbiórka, wytwarzanie, badania, sieć z magazynem, skróty wszystkich 14 etapów, spójność danych, żegluga Żaglowozu |
| `sail.test.ts` | demo „Żegluga”: podłoża i przeszkody na mapie, cień wiatru za domem, szkwały, szybciej niż wiatr, martwy kąt, koła i płozy w sypkim popiele, przechył i wywrotka, balast, silnik i bateria Wolta, wczepianie i odczepianie, lekcje symulatora i egzamin pod wiatr (sternik-automat), przód na sypkim popiele, poślizg, hamulec i zmiana podwozia, odbicie od domu, trasy |
| `i18n.test.ts` | język poza przeglądarką, korpus notatek niezależny od języka |

Nowa mechanika w logice dostaje test. Testy logiki nie dotykają Three.js.

## Build

- `npm run dev`: Vite na localhost, gra pod `/`, demo pod `/demo/`.
- `npm run build`: `tsc --noEmit` (typy), potem `vite build` do `dist/` z czterema stronami (`rollupOptions.input`: `index.html`, `demo/index.html`, `demo-craft/index.html`, `demo-sail/index.html`). `base: './'`, więc działa pod `/power-and-ash/`.
- `npm run build:single`: jeden samodzielny plik HTML w `dist-single/` (modele wklejone jako data URI). Domyślnie gra, `PAGE=demo` robi demo, `PAGE=craft` demo „Warsztat”, `PAGE=sail` demo „Żegluga”. Przydaje się do publikacji jako artefakt.
- Modele: paczki CC0 (zipy z itch.io, chmura nie ma do nich dostępu, więc Wojtek wrzucił je do `~/prv/ash-and-power/assets` na swoim komputerze) rozpakowuje się do `assets-src/` i uruchamia `node tools/pack-models.mjs` (zostawia kolor bazowy, tekstury 256 px WebP, upraszcza siatki, kompresja meshopt). Wynik jest w repo w `src/assets/models/`, więc zwykły build nie potrzebuje paczek.
- Modele „Warsztatu”: paczki KayKit Space Base / Furniture / City Builder Bits są publicznie na GitHubie (`github.com/KayKit-Game-Assets`), więc chmura je klonuje. `ASSETS_SRC=<katalog z klonami> node tools/pack-craft-models.mjs` pakuje wybrane modele do `src/assets/craft/`.

## CI i deploy

| Workflow | Kiedy | Co robi |
|---|---|---|
| `.github/workflows/ci.yml` | każdy PR | `npm ci`, `npm test`, `npm run build` |
| `.github/workflows/pages.yml` | push na `main` (i ręcznie) | to samo, potem `cp -r docs dist/docs` i deploy na GitHub Pages |
| `.github/workflows/labels.yml` | push na `main` ze zmianą `.github/labels.yml` (i ręcznie) | zakłada albo poprawia etykiety zgłoszeń (`bug`, `pomysł`, `do-decyzji`) |

- Pages ma w ustawieniach repo źródło **GitHub Actions** (włączył to Wojtek, API z chmury tego nie pozwala).
- Adresy: gra https://wjurkowlaniec.github.io/power-and-ash/, tech demo https://wjurkowlaniec.github.io/power-and-ash/demo/, dokumenty https://wjurkowlaniec.github.io/power-and-ash/docs/ (np. `docs/design.html`).
- Zgłoszenia testerów: formularze „Błąd” i „Pomysł” w `.github/ISSUE_TEMPLATE/`, przewodnik w [README: Jak testować](../README.md#jak-testować).
- Każda zmiana ma trafić na Pages do testów: PR, zielone CI, squash-merge do `main`, a deploy rusza sam. Jeśli strona pokazuje starą wersję, pomaga Ctrl+Shift+R.

## Konwencje

- Logika w `sim/`, widok w `render/`, klej w `scenes/` albo `main.ts`. Stałe balansu na górze pliku logiki, z jednostką w komentarzu.
- Komentarze w kodzie po angielsku, krótkie i o tym „dlaczego”. Dokumentacja, commity i PR-y po polsku.
- Teksty dla gracza zawsze przez `tr('pl', 'en')`.
- `localStorage` zawsze w `try/catch` (tryb prywatny, zablokowane dane).
- Bez martwego kodu i bez zakomentowanych bloków.
